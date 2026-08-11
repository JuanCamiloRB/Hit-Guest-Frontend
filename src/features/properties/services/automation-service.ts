/**
 * Automation Service — CRUD for property automations.
 *
 * UUID policy: All public endpoints use UUID. Passing integer IDs returns 404.
 *
 * Endpoints:
 *   GET    /api/v1/property-automations                              → listGlobal (filterable)
 *   GET    /api/v1/properties/{propertyUuid}/automations             → list (by property)
 *   GET    /api/v1/property-automations/{uuid}                       → show
 *   POST   /api/v1/property-automations                              → create
 *   PATCH  /api/v1/property-automations/{uuid}                       → update (partial)
 *   PATCH  /api/v1/property-automations/{uuid}/configure             → configure (activate/deactivate)
 *   DELETE /api/v1/property-automations/{uuid}                       → remove (soft-delete)
 *   POST   /api/v1/property-automations/{uuid}/restore               → restore
 *   GET    /api/v1/providers                                         → listProviders
 *   GET    /api/v1/reservations/{uuid}/automation-status             → getReservationStatus
 *   GET    /api/v1/reservations/{uuid}/automation-records            → listUsageRecords
 *   POST   /api/v1/reservations/{uuid}/automation-records/{id}/redispatch → redispatch
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import type {
    PropertyAutomation,
    PropertyAutomationCreatePayload,
    PropertyAutomationUpdatePayload,
    PropertyAutomationConfigurePayload,
    Provider,
    AutomationUsageRecord,
    AutomationStatusItem,
    AutomationLiveStatus,
    ListingAutomationOverride,
    ListingAutomationOverrideCreatePayload,
    ListingAutomationOverrideUpdatePayload,
    ListingOverrideStatus,
} from "../types/automation"
import { LISTING_OVERRIDE_STATUS, isSignatureProvider } from "../types/automation"
import {
    normalizeAutomationStatus,
    normalizeExecutionOrder,
    normalizeOptionalId,
} from "../lib/automation-numbers"

/**
 * Canonicalizes a provider slug so comparisons are stable regardless of the
 * separator the backend uses — providerSlug may arrive as "pdf_report" or
 * "pdf-report". Canonical form: lowercase with underscores.
 */
export function canonicalSlug(slug: string | null | undefined): string {
    return (slug ?? "").toLowerCase().replace(/-/g, "_")
}

// ── Query param helpers ─────────────────────────────────────────────────────

export interface AutomationListParams {
    propertyUuid?: string
    providerId?: number
    guestType?: "main_guest" | "secondary_guest" | "all"
    statusProviderId?: 8 | 10
    includeProvider?: boolean
    includeProperty?: boolean
    page?: number
}

export interface ProviderListParams {
    statusProviderId?: 8 | 10
    includeIntegrations?: boolean
    /**
     * ISO2 country code (e.g. "CO") — only returns providers applicable to that
     * country (`parameters.applicable_countries` contains it or `"ALL"`).
     * New 2026-08-03; omit to get every provider unfiltered (unchanged default).
     * Property configuration screens resolve countryId through the countries
     * catalog and always pass this filter.
     */
    country?: string
}

// ── Service ──────────────────────────────────────────────────────────────────

class AutomationService {

    /**
     * Normalizes raw API response item → PropertyAutomation.
     * Handles camelCase / snake_case variants from Laravel resources.
     */
    private normalize(raw: any): PropertyAutomation {
        const executionOrder = normalizeExecutionOrder(raw.executionOrder ?? raw.execution_order)
        const statusProviderId = normalizeAutomationStatus(raw.statusProviderId ?? raw.status_provider_id)
        const providerId = normalizeOptionalId(raw.providerId ?? raw.provider_id)
        const provider = raw.provider ?? null
        return {
            ...raw,
            uuid: raw.uuid,
            propertyUuid: raw.propertyUuid ?? raw.property_uuid ?? "",
            providerId,
            name: raw.name ?? "",
            guestType: raw.guestType ?? raw.guest_type ?? "all",
            executionOrder,
            parameters: raw.parameters ?? {},
            token: raw.token ?? null,
            statusProviderId,
            deletedAt: raw.deletedAt ?? raw.deleted_at ?? null,
            provider,
            property: raw.property ?? null,
            usageRecords: raw.usageRecords ?? raw.usage_records ?? null,
            isActive: statusProviderId === 8,
            providerName: raw.providerName ?? provider?.parameters?.slug ?? provider?.parameters?.internalUse?.path ?? null,
            automationOrder: executionOrder,
        }
    }

    private normalizeList(response: any): PropertyAutomation[] {
        const items = response?.data ?? response
        return Array.isArray(items) ? items.map((r: any) => this.normalize(r)) : []
    }

    // ── List by property ────────────────────────────────────────────────────

    /**
     * GET /api/v1/properties/{propertyUuid}/automations
     * Returns automations for a specific property ordered by executionOrder.
     */
    async list(
        propertyUuid: string,
        opts: { includeProvider?: boolean } = {},
    ): Promise<PropertyAutomation[]> {
        const params = new URLSearchParams()
        if (opts.includeProvider) params.set("includeProvider", "true")
        const qs = params.toString() ? `?${params}` : ""
        const url = `${API_BASE}/properties/${propertyUuid}/automations${qs}`
        try {
            const response = await apiClient.get<any>(url, { suppressUnauthorizedRedirect: true })
            return this.normalizeList(response)
        } catch (error: any) {
            console.error("[AutomationService] list error:", error)
            // 404 = property has no automations yet; 401 = possible race condition
            // right after property creation where the backend hasn't propagated
            // the auth context. In both cases return empty to avoid triggering
            // the global handleUnauthorized → logout flow.
            if (error?.status === 404 || error?.status === 401) return []
            throw error
        }
    }

    // ── Global list (filterable) ────────────────────────────────────────────

    /**
     * GET /api/v1/property-automations
     * Supports filter operators: ?propertyUuid[eq]=, ?statusProviderId[eq]=8, etc.
     */
    async listGlobal(params: AutomationListParams = {}): Promise<PropertyAutomation[]> {
        const qs = new URLSearchParams()
        if (params.propertyUuid)     qs.set("propertyUuid[eq]", params.propertyUuid)
        if (params.providerId)       qs.set("providerId[eq]", String(params.providerId))
        if (params.guestType)        qs.set("guestType[eq]", params.guestType)
        if (params.statusProviderId) qs.set("statusProviderId[eq]", String(params.statusProviderId))
        if (params.includeProvider)  qs.set("includeProvider", "true")
        if (params.includeProperty)  qs.set("includeProperty", "true")
        if (params.page)             qs.set("page", String(params.page))
        const url = `${API_BASE}/property-automations${qs.toString() ? `?${qs}` : ""}`
        try {
            const response = await apiClient.get<any>(url, { suppressUnauthorizedRedirect: true })
            return this.normalizeList(response)
        } catch (error: any) {
            console.error("[AutomationService] listGlobal error:", error)
            if (error?.status === 404 || error?.status === 401) return []
            throw error
        }
    }

    // ── CRUD ────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/property-automations/{uuid}
     */
    async show(
        automationUuid: string,
        opts: { includeProvider?: boolean; includeUsageRecords?: boolean } = {},
    ): Promise<PropertyAutomation> {
        const qs = new URLSearchParams()
        if (opts.includeProvider)     qs.set("includeProvider", "true")
        if (opts.includeUsageRecords) qs.set("includeUsageRecords", "true")
        const url = `${API_BASE}/property-automations/${automationUuid}${qs.toString() ? `?${qs}` : ""}`
        try {
            const response = await apiClient.get<any>(url)
            return this.normalize(response?.data ?? response)
        } catch (error: any) {
            console.error("[AutomationService] show error:", error)
            throw error
        }
    }

    /**
     * POST /api/v1/property-automations
     * Creates a new automation record for the given propertyUuid.
     */
    async create(payload: PropertyAutomationCreatePayload): Promise<PropertyAutomation> {
        const url = `${API_BASE}/property-automations`
        try {
            const response = await apiClient.post<any>(url, payload)
            return this.normalize(response?.data ?? response)
        } catch (error: any) {
            console.error("[AutomationService] create error:", error)
            throw error
        }
    }

    /**
     * PATCH /api/v1/property-automations/{uuid}
     * Partial update. Cannot change providerId or propertyUuid — use configure for that.
     */
    async update(
        automationUuid: string,
        payload: PropertyAutomationUpdatePayload,
    ): Promise<PropertyAutomation> {
        const url = `${API_BASE}/property-automations/${automationUuid}`
        try {
            const response = await apiClient.patch<any>(url, payload)
            return this.normalize(response?.data ?? response)
        } catch (error: any) {
            console.error("[AutomationService] update error:", error)
            throw error
        }
    }

    /**
     * PATCH /api/v1/property-automations/{uuid}/configure
     * Primary endpoint for activation/deactivation and provider configuration.
     *   Activate:   { statusProviderId: 8, providerId, parameters }
     *   Deactivate: { statusProviderId: 10 }
     * The Digital Contract automation (identified by `provider.parameters.signature`,
     * not by executionOrder — see getContractRoutingAutomation()) cannot be
     * deactivated (returns 422).
     */
    async configure(
        automationUuid: string,
        payload: PropertyAutomationConfigurePayload,
    ): Promise<PropertyAutomation> {
        const url = `${API_BASE}/property-automations/${automationUuid}/configure`
        try {
            const response = await apiClient.patch<any>(url, payload)
            return this.normalize(response?.data ?? response)
        } catch (error: any) {
            console.error("[AutomationService] configure error:", error)
            throw error
        }
    }

    /**
     * Finds the property's "Digital Contract" automation — the one whose
     * `parameters` carries `contract_mode`/`by_source`. Per the backend plan
     * this automation always exists and is always active, but a property
     * created before this feature (or with no automations yet) legitimately
     * has none — callers treat `null` as "not configured".
     *
     * Identified by `provider.parameters.signature` being present, NOT by
     * `executionOrder === 3` (⚠️ 20260803_frontend-property-automations-api.md:
     * a country/provider-map refactor means which automations get auto-created,
     * and in what order, now depends on the property's country — executionOrder
     * for anything from position 3 onward is no longer a reliable identifier).
     * Requires `includeProvider: true` so `provider` is actually populated.
     */
    async getContractRoutingAutomation(propertyUuid: string): Promise<PropertyAutomation | null> {
        const automations = await this.list(propertyUuid, { includeProvider: true })
        return automations.find((a) => a.provider != null && isSignatureProvider(a.provider)) ?? null
    }

    /**
     * Convenience wrapper: activate or deactivate via configure endpoint.
     */
    async toggle(automationUuid: string, isActive: boolean, currentProviderId?: number | null): Promise<PropertyAutomation> {
        const payload: PropertyAutomationConfigurePayload = { statusProviderId: isActive ? 8 : 10 }
        if (isActive && currentProviderId != null) {
            payload.providerId = currentProviderId
        }
        return this.configure(automationUuid, payload)
    }

    /**
     * DELETE /api/v1/property-automations/{uuid}
     * Soft-deletes the automation and sets its status to inactive.
     */
    async remove(automationUuid: string): Promise<void> {
        const url = `${API_BASE}/property-automations/${automationUuid}`
        try {
            await apiClient.delete<void>(url)
        } catch (error: any) {
            console.error("[AutomationService] remove error:", error)
            throw error
        }
    }

    /**
     * POST /api/v1/property-automations/{uuid}/restore
     * Restores a soft-deleted automation and sets status to active (8).
     */
    async restore(automationUuid: string): Promise<PropertyAutomation> {
        const url = `${API_BASE}/property-automations/${automationUuid}/restore`
        try {
            const response = await apiClient.post<any>(url, {})
            return this.normalize(response?.data ?? response)
        } catch (error: any) {
            console.error("[AutomationService] restore error:", error)
            throw error
        }
    }

    // ── Providers ────────────────────────────────────────────────────────────

    /** Session-token header for the raw fetch below — same helper as property-document-service.ts. */
    private authHeader(): Record<string, string> {
        const token = useAuthStore.getState().user?.token
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    /**
     * GET /api/v1/providers
     * Used to populate provider selectors in the UI and resolve slug → id mapping.
     *
     * The provider catalog is paginated (15/page by default) but callers treat
     * it as a closed set to pick from — not a table a PM pages through — so
     * this auto-follows every page and returns the full flat list. `apiClient`
     * unwraps the response down to just `data`, discarding `meta`, so (same as
     * `propertyDocumentService.list()`) this reads `meta.last_page` via a raw
     * fetch instead. `MAX_PAGES` is only a safety net against an infinite loop
     * if a future response is missing/malformed `meta` — 20 pages already
     * covers 300 providers at the default page size.
     */
    async listProviders(params: ProviderListParams = {}): Promise<Provider[]> {
        const MAX_PAGES = 20
        const qs = new URLSearchParams()
        if (params.statusProviderId)    qs.set("statusProviderId[eq]", String(params.statusProviderId))
        if (params.includeIntegrations) qs.set("includeIntegrations", "true")
        if (params.country)             qs.set("country", params.country)

        const all: Provider[] = []
        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                const pageQs = new URLSearchParams(qs)
                pageQs.set("page", String(page))
                const res = await fetch(`${API_BASE}/providers?${pageQs}`, {
                    headers: { Accept: "application/json", ...this.authHeader() },
                    cache: "no-store",
                })
                if (!res.ok) {
                    if (res.status === 404 || res.status === 401) break
                    throw new Error(`HTTP ${res.status}`)
                }
                const json = await res.json()
                const items = Array.isArray(json?.data) ? json.data : []
                all.push(...items)

                const lastPage = Number(json?.meta?.last_page ?? 1)
                if (page >= lastPage) break
            }
            return all
        } catch (error: any) {
            console.error("[AutomationService] listProviders error:", error)
            return all
        }
    }

    // ── Reservation Automation Status ────────────────────────────────────────

    /**
     * Normalizes a raw automation-status item, tolerating camelCase/snake_case.
     */
    private normalizeStatusItem(raw: any): AutomationStatusItem {
        const status: AutomationLiveStatus = raw.status ?? "not_started"
        const payload = raw.responsePayload ?? raw.response_payload ?? null
        const pdfPath = payload?.pdf_path ?? raw.contractPdfPath ?? raw.contract_pdf_path ?? null
        // Backend action flags (dispatch panel contract). Defaults keep the old
        // behaviour when an older backend doesn't send them yet: canDispatch falls
        // back to the not_started heuristic, and gates default to "satisfied".
        const pick = <T,>(camel: T | undefined, snake: T | undefined, fallback: T): T =>
            (camel ?? snake ?? fallback)
        return {
            automationUuid: raw.automationUuid ?? raw.automation_uuid ?? "",
            automationName: raw.automationName ?? raw.automation_name ?? "",
            providerSlug: canonicalSlug(raw.providerSlug ?? raw.provider_slug),
            status,
            lastError: raw.lastError ?? raw.last_error ?? null,
            lastRunAt: raw.lastRunAt ?? raw.last_run_at ?? null,
            usageRecordId: raw.usageRecordId ?? raw.usage_record_id ?? null,
            contractPdfPath: typeof pdfPath === "string" ? pdfPath : null,
            wasSuccessful: pick(raw.wasSuccessful, raw.was_successful, status === "completed"),
            lastSuccessAt: raw.lastSuccessAt ?? raw.last_success_at ?? null,
            requiresCheckin: pick(raw.requiresCheckin, raw.requires_checkin, null),
            redispatchRequiresCheckin: pick(raw.redispatchRequiresCheckin, raw.redispatch_requires_checkin, null),
            canManualDispatch: pick(raw.canManualDispatch, raw.can_manual_dispatch, true),
            reservationCheckinCompleted: pick(raw.reservationCheckinCompleted, raw.reservation_checkin_completed, true),
            mainGuestCheckinCompleted: pick(raw.mainGuestCheckinCompleted, raw.main_guest_checkin_completed, true),
            canDispatch: pick(raw.canDispatch, raw.can_dispatch, status === "not_started"),
            canRedispatch: pick(raw.canRedispatch, raw.can_redispatch, status === "failed"),
        }
    }

    /**
     * GET /api/v1/reservations/{reservationUuid}/automation-status
     * Returns the current status of every active automation for the reservation,
     * ordered by execution_order. Includes automations that never ran (not_started).
     */
    async getReservationStatus(reservationUuid: string): Promise<AutomationStatusItem[]> {
        const statusUrl = `${API_BASE}/reservations/${reservationUuid}/automation-status`
        try {
            // /automation-status already carries everything the panel renders
            // (including contractPdfPath), so a single request per poll is enough.
            const statusRes = await apiClient.get<any>(statusUrl)
            const items: any[] = Array.isArray(statusRes?.data ?? statusRes) ? (statusRes?.data ?? statusRes) : []
            return items.map((r: any) => this.normalizeStatusItem(r))
        } catch (error: any) {
            console.error("[AutomationService] getReservationStatus error:", error)
            throw error
        }
    }

    // ── Usage Records ────────────────────────────────────────────────────────

    /**
     * GET /api/v1/reservations/{reservationUuid}/automation-records
     * Returns automation execution history for a reservation, newest first.
     */
    async listUsageRecords(
        reservationUuid: string,
        automationUuid?: string,
    ): Promise<AutomationUsageRecord[]> {
        const base = `${API_BASE}/reservations/${reservationUuid}/automation-records`
        const url = automationUuid ? `${base}?automationUuid=${automationUuid}` : base
        try {
            const response = await apiClient.get<any>(url)
            const items = response?.data ?? response
            return Array.isArray(items) ? items : []
        } catch (error: any) {
            console.error("[AutomationService] listUsageRecords error:", error)
            throw error
        }
    }

    /**
     * POST /api/v1/reservations/{reservationUuid}/automation-records/{recordId}/redispatch
     * Re-queues a failed automation execution. Only works for status="failed" records.
     * Returns 422 if record is not failed, or if no job handler exists for the provider.
     */
    async redispatch(reservationUuid: string, recordId: number): Promise<{ message: string }> {
        const url = `${API_BASE}/reservations/${reservationUuid}/automation-records/${recordId}/redispatch`
        try {
            return await apiClient.post<{ message: string }>(url, {})
        } catch (error: any) {
            console.error("[AutomationService] redispatch error:", error)
            throw error
        }
    }

    /**
     * POST /api/v1/reservations/{reservationUuid}/property-automations/{automationUuid}/dispatch
     * Manually triggers an automation that has NOT run yet (status "not_started").
     * Different from redispatch (which re-runs a FAILED automation).
     * 202 queued · 404 not found · 422 inactive/already-run/failed(use redispatch)/no-handler · 429 cooldown.
     */
    async dispatch(reservationUuid: string, automationUuid: string): Promise<{ message: string }> {
        const url = `${API_BASE}/reservations/${reservationUuid}/property-automations/${automationUuid}/dispatch`
        try {
            return await apiClient.post<{ message: string }>(url, {})
        } catch (error: any) {
            console.error("[AutomationService] dispatch error:", error)
            throw error
        }
    }

    /**
     * POST /api/v1/reservations/{reservationUuid}/property-automations/{automationUuid}/resend-pdf
     * Resends the Guest Report PDF email for an already-completed automation.
     * Unlike dispatch, this is allowed for completed automations.
     */
    async resendPdf(reservationUuid: string, automationUuid: string): Promise<{ message: string }> {
        const url = `${API_BASE}/reservations/${reservationUuid}/property-automations/${automationUuid}/resend-pdf`
        try {
            return await apiClient.post<{ message: string }>(url, {})
        } catch (error: any) {
            console.error("[AutomationService] resendPdf error:", error)
            throw error
        }
    }

    // ── Convenience ──────────────────────────────────────────────────────────

    /**
     * Upsert by executionOrder: configure if record exists, create if not.
     * Used when the backend may or may not have auto-created the 8 default records.
     */
    async upsertByOrder(
        propertyUuid: string,
        existing: PropertyAutomation[],
        payload: PropertyAutomationCreatePayload,
    ): Promise<PropertyAutomation> {
        const match = existing.find(
            a => (a.executionOrder ?? a.automationOrder) === payload.executionOrder,
        )
        if (match) {
            return this.configure(match.uuid, {
                statusProviderId: payload.statusProviderId,
                providerId: payload.providerId ?? undefined,
                parameters: payload.parameters,
            })
        }
        return this.create({ ...payload, propertyUuid })
    }

    // ── Listing Automation Overrides ─────────────────────────────────────────
    //
    // Per-listing parameter/status/token overrides for property-level automations.
    // One override per (listing, propertyAutomation) pair. Backed by real endpoints.

    /** Normalizes a raw API override item into ListingAutomationOverride. */
    private normalizeOverride(r: any, listingUuid?: string): ListingAutomationOverride {
        const statusRecordId: ListingOverrideStatus =
            (r.statusRecordId ?? r.status_record_id ?? LISTING_OVERRIDE_STATUS.ACTIVE) as ListingOverrideStatus
        const rawPa = r.propertyAutomation ?? r.property_automation ?? null
        return {
            uuid: r.uuid,
            listingUuid: r.listingUuid ?? r.listing_uuid ?? listingUuid ?? "",
            propertyAutomationUuid: r.propertyAutomationUuid ?? r.property_automation_uuid ?? "",
            parameters: r.parameters ?? null,
            token: r.token ?? null,
            statusRecordId,
            deletedAt: r.deletedAt ?? r.deleted_at ?? null,
            propertyAutomation: rawPa
                ? {
                    uuid: rawPa.uuid,
                    propertyUuid: rawPa.propertyUuid ?? rawPa.property_uuid,
                    providerId: rawPa.providerId ?? rawPa.provider_id ?? null,
                    name: rawPa.name ?? "",
                    guestType: rawPa.guestType ?? rawPa.guest_type,
                    executionOrder: rawPa.executionOrder ?? rawPa.execution_order,
                    parameters: rawPa.parameters ?? null,
                    token: rawPa.token ?? null,
                    statusProviderId: rawPa.statusProviderId ?? rawPa.status_provider_id,
                    provider: rawPa.provider ?? null,
                }
                : null,
            isActive: statusRecordId === LISTING_OVERRIDE_STATUS.ACTIVE,
        }
    }

    /**
     * GET /api/v1/listings/{listingUuid}/automation-overrides?includePropertyAutomation=1
     * Returns all overrides for a listing (no pagination — overrides per listing are few).
     */
    async listListingOverrides(listingUuid: string): Promise<ListingAutomationOverride[]> {
        const url = `${API_BASE}/listings/${listingUuid}/automation-overrides?includePropertyAutomation=1`
        try {
            const response: any = await apiClient.get(url)
            const items = response?.data ?? response
            return Array.isArray(items) ? items.map((r: any) => this.normalizeOverride(r, listingUuid)) : []
        } catch (error: any) {
            console.error("[AutomationService] listListingOverrides error:", error)
            if (error?.status === 404) return []
            throw error
        }
    }

    /**
     * GET /api/v1/listing-automation-overrides/{uuid}?includePropertyAutomation=1
     */
    async getListingOverride(overrideUuid: string): Promise<ListingAutomationOverride> {
        const url = `${API_BASE}/listing-automation-overrides/${overrideUuid}?includePropertyAutomation=1`
        const response: any = await apiClient.get(url)
        return this.normalizeOverride(response?.data ?? response)
    }

    /**
     * POST /api/v1/listing-automation-overrides
     * Creates a new override. listingUuid goes in the body, not the URL.
     */
    async createListingOverride(
        payload: ListingAutomationOverrideCreatePayload,
    ): Promise<ListingAutomationOverride> {
        const url = `${API_BASE}/listing-automation-overrides`
        const response: any = await apiClient.post(url, payload)
        return this.normalizeOverride(response?.data ?? response, payload.listingUuid)
    }

    /**
     * PATCH /api/v1/listing-automation-overrides/{uuid}
     * Partial update. `parameters` is merged server-side; send a key as null to clear it.
     * propertyAutomationUuid is immutable and cannot be changed here.
     */
    async updateListingOverride(
        overrideUuid: string,
        payload: ListingAutomationOverrideUpdatePayload,
    ): Promise<ListingAutomationOverride> {
        const url = `${API_BASE}/listing-automation-overrides/${overrideUuid}`
        const response: any = await apiClient.patch(url, payload)
        return this.normalizeOverride(response?.data ?? response)
    }

    /**
     * DELETE /api/v1/listing-automation-overrides/{uuid}  (soft-delete)
     */
    async deleteListingOverride(overrideUuid: string): Promise<void> {
        const url = `${API_BASE}/listing-automation-overrides/${overrideUuid}`
        await apiClient.delete<void>(url)
    }

    /**
     * POST /api/v1/listing-automation-overrides/{uuid}/restore
     */
    async restoreListingOverride(overrideUuid: string): Promise<ListingAutomationOverride> {
        const url = `${API_BASE}/listing-automation-overrides/${overrideUuid}/restore`
        const response: any = await apiClient.post(url, {})
        return this.normalizeOverride(response?.data ?? response)
    }
}

export const automationService = new AutomationService()
