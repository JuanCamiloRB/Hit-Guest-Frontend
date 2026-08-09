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
import {
    INTEGRATION_STATUS,
    type Integration,
    type IntegrationStatus,
    type KunasConfigurationPayload,
    type KunasConnectPayload,
} from "../types"

class IntegrationsService {
    /**
     * Current Kunas integration for the PM, or `null` when none exists (404).
     * `suppressUnauthorizedRedirect` keeps a session-token 401 from being
     * swallowed here — it still throws so the caller/global handler can react.
     */
    async getKunas(): Promise<Integration | null> {
        const url = `${API_BASE}/kunas-pms/integration`
        try {
            return await apiClient.get<Integration>(url)
        } catch (error) {
            if (isNotFound(error)) return null
            throw error
        }
    }

    /**
     * First connection (or full reconnect). Returns the created/updated
     * integration; the property/reservation sync runs asynchronously on the
     * backend, so `parameters.pmsProperties` may still be empty here.
     */
    async connect(payload: KunasConnectPayload): Promise<Integration> {
        const url = `${API_BASE}/kunas-pms/connect`
        return apiClient.post<Integration>(url, payload)
    }

    /**
     * Update stored KunasPMS credentials (email/password). Validates the new
     * credentials against KunasPMS before saving; does NOT re-sync properties.
     */
    async updateConfiguration(
        payload: KunasConfigurationPayload,
    ): Promise<Integration> {
        const url = `${API_BASE}/kunas-pms/configuration`
        return apiClient.patch<Integration>(url, payload)
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
    ): Promise<Integration> {
        return apiClient.patch<Integration>(this.integrationUrl(token), { statusProviderId })
    }

    activate(token: string): Promise<Integration> {
        return this.setStatus(token, INTEGRATION_STATUS.ACTIVE)
    }

    deactivate(token: string): Promise<Integration> {
        return this.setStatus(token, INTEGRATION_STATUS.INACTIVE)
    }

    /** Remove the integration link (204). Imported data is preserved. */
    async disconnect(token: string): Promise<void> {
        await apiClient.delete<void>(this.integrationUrl(token))
    }
}

export const integrationsService = new IntegrationsService()
