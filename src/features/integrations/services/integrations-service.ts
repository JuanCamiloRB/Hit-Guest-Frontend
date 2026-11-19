/**
 * Integrations Service — Kunas PMS.
 *
 * Endpoints (all authenticated with the PM's session token, which apiClient
 * attaches by default):
 *   GET    /api/v1/kunas-pms/integration      → getKunas (404 ⇒ null: not connected)
 *   POST   /api/v1/kunas-pms/connect          → connect (202: created + async sync)
 *   PATCH  /api/v1/kunas-pms/configuration    → updateConfiguration (creds only, no re-sync)
 *   PATCH  /api/v1/integrations/{id}          → setStatus (activate/deactivate)
 *   DELETE /api/v1/integrations/{id}          → disconnect (204)
 *
 * `{id}` above accepts either the numeric id or the root-level HIT token per
 * the API contract; this service addresses it by token.
 *
 * apiClient unwraps the `{ data }` envelope, so every method that returns an
 * Integration receives the inner resource directly.
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { isNotFound } from "../lib/integration-errors"
import { readCredentialsStatus } from "@/lib/credentials-rejection"
import {
    INTEGRATION_STATUS,
    type Integration,
    type IntegrationStatus,
    type KunasConfigurationPayload,
    type KunasConnectPayload,
} from "../types"

/**
 * La respuesta, leída en el borde. Solo es una integración si trae el `token`
 * raíz (lo único que el front usa para direccionarla); si no, `null`: un 202
 * de `connect` que solo dice «aceptado» o un cuerpo inesperado NO se pinta como
 * una integración (eso tumbaba la pantalla al leer `parameters.email`, visto
 * en producción el 2026-11-18). Se normaliza:
 *   - `parameters`: siempre un objeto (la tarjeta lee `email` y `pmsProperties`);
 *   - `credentialsStatus` (nota 2026-11-11): `null`, un objeto bien formado, o
 *     ausente si la respuesta no lo trajo (pausar no levanta un rechazo: el
 *     hook conserva lo que ya sabía).
 */
export function readIntegration(raw: unknown): Integration | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
    const record = raw as Record<string, unknown>
    if (typeof record.token !== "string" || record.token.trim() === "") return null
    const parameters = record.parameters
    const next = {
        ...record,
        parameters: typeof parameters === "object" && parameters !== null && !Array.isArray(parameters) ? parameters : {},
    } as Integration
    const credentialsStatus = readCredentialsStatus(record)
    delete next.credentialsStatus
    if (credentialsStatus !== undefined) next.credentialsStatus = credentialsStatus
    return next
}

/** Un 200 que no es una integración: «no se pudo leer», nunca «no hay integración». */
export class UnreadableIntegrationError extends Error {
    constructor() {
        super("La respuesta de la integración llegó incompleta.")
        this.name = "UnreadableIntegrationError"
    }
}

class IntegrationsService {
    /**
     * Current Kunas integration for the PM, or `null` when none exists (404).
     * `suppressUnauthorizedRedirect` keeps a session-token 401 from being
     * swallowed here — it still throws so the caller/global handler can react.
     */
    async getKunas(): Promise<Integration | null> {
        const url = `${API_BASE}/kunas-pms/integration`
        let raw: unknown
        try {
            raw = await apiClient.get<unknown>(url)
        } catch (error) {
            if (isNotFound(error)) return null
            throw error
        }
        // Un 200 ilegible no es «no conectado»: mostrar el formulario invitaría a
        // reconectar algo que existe. Se dice que no se pudo leer (con Reintentar).
        const integration = readIntegration(raw)
        if (!integration) throw new UnreadableIntegrationError()
        return integration
    }

    /**
     * First connection (or full reconnect). Returns the created/updated
     * integration; the property/reservation sync runs asynchronously on the
     * backend, so `parameters.pmsProperties` may still be empty here.
     * `null` = the 202 did not include the resource: the caller fetches it.
     */
    async connect(payload: KunasConnectPayload): Promise<Integration | null> {
        const url = `${API_BASE}/kunas-pms/connect`
        return readIntegration(await apiClient.post<unknown>(url, payload))
    }

    /**
     * Update stored KunasPMS credentials (email/password). Validates the new
     * credentials against KunasPMS before saving; does NOT re-sync properties.
     */
    async updateConfiguration(
        payload: KunasConfigurationPayload,
    ): Promise<Integration | null> {
        const url = `${API_BASE}/kunas-pms/configuration`
        return readIntegration(await apiClient.patch<unknown>(url, payload))
    }

    /**
     * Builds `/integrations/{id}` from the ROOT-level token, refusing to build a
     * URL out of a missing one.
     *
     * This is the guard for the bug that shipped as `PATCH /integrations/undefined
     * → 404`: template literals happily interpolate `undefined`, so a field that
     * the API never returned turned into a valid-looking request. Fail here, with
     * a name, instead of at the backend with a 404.
     */
    private integrationUrl(token: string): string {
        if (!token) {
            throw new Error(
                "[integrations] Falta el token raíz de la integración. "
                + "Usa `integration.token`, no `integration.parameters.token`.",
            )
        }
        return `${API_BASE}/integrations/${encodeURIComponent(token)}`
    }

    /** Activate (8) or deactivate (10) an integration by its root-level token. */
    async setStatus(
        token: string,
        statusProviderId: IntegrationStatus,
    ): Promise<Integration | null> {
        return readIntegration(await apiClient.patch<unknown>(this.integrationUrl(token), { statusProviderId }))
    }

    activate(token: string): Promise<Integration | null> {
        return this.setStatus(token, INTEGRATION_STATUS.ACTIVE)
    }

    deactivate(token: string): Promise<Integration | null> {
        return this.setStatus(token, INTEGRATION_STATUS.INACTIVE)
    }

    /** Remove the integration link (204). Imported data is preserved. */
    async disconnect(token: string): Promise<void> {
        await apiClient.delete<void>(this.integrationUrl(token))
    }
}

export const integrationsService = new IntegrationsService()
