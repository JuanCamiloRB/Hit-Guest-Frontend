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

    /** Activate (8) or deactivate (10) an integration by its numeric id. */
    async setStatus(
        id: number,
        statusProviderId: IntegrationStatus,
    ): Promise<Integration> {
        const url = `${API_BASE}/integrations/${id}`
        return apiClient.patch<Integration>(url, { statusProviderId })
    }

    activate(id: number): Promise<Integration> {
        return this.setStatus(id, INTEGRATION_STATUS.ACTIVE)
    }

    deactivate(id: number): Promise<Integration> {
        return this.setStatus(id, INTEGRATION_STATUS.INACTIVE)
    }

    /** Remove the integration link (204). Imported data is preserved. */
    async disconnect(id: number): Promise<void> {
        const url = `${API_BASE}/integrations/${id}`
        await apiClient.delete<void>(url)
    }
}

export const integrationsService = new IntegrationsService()
