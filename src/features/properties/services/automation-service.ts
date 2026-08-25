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

import { apiClient, handleSessionExpired } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError, type ApiErrorResponse } from "@/types/api"
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
import { LISTING_OVERRIDE_STATUS } from "../types/automation"
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

/**
 * Recorta un `Provider` a la forma EXACTA que el frontend usa.
 *
 * El backend serializa el modelo `Provider` completo cuando viene sideloaded,
 * incluidos sus `parameters` — y ahí es donde TuFirma y Stripe Card On File
 * guardan tokens y llaves. Lo tiene priorizado de su lado; esto es defensa
 * adicional: lo que no entra al modelo no puede terminar en el estado de React,
 * en un `console.log` ni en un reporte de error.
 *
 * ## Allowlist PROFUNDA, no superficial
 *
 * Recortar solo el primer nivel no alcanza: una rama permitida arrastra lo que
 * lleve adentro. `default_setup.slots[].parameters` es el caso concreto — hoy
 * trae las claves de credenciales con valor vacío, pero nada impide que mañana
 * traiga un `client_secret` con valor. Por eso cada rama se reconstruye campo
 * por campo, y de los `parameters` de un slot **se conservan las claves y se
 * vacían los valores**: `fieldsForSlot` solo lee `Object.keys()`, así que
 * blanquearlos no pierde nada y elimina el vector entero.
 *
 * Devuelve `Provider` de verdad —no un genérico con `as`— para que el tipo no
 * afirme campos que esta función acaba de borrar.
 */
export function sanitizeProvider(raw: unknown): Provider | null {
    if (!raw || typeof raw !== "object") return null
    const p = raw as Record<string, unknown>
    const params = (p.parameters && typeof p.parameters === "object" ? p.parameters : {}) as Record<string, unknown>

    const id = typeof p.id === "number" && Number.isFinite(p.id) ? p.id : null
    const name = typeof p.name === "string" ? p.name : null
    if (id == null || name == null) return null

    const parameters: Provider["parameters"] = {
        slug: typeof params.slug === "string" ? params.slug : "",
    }

    const internalUse = params.internalUse as Record<string, unknown> | undefined
    if (typeof internalUse?.path === "string") {
        parameters.internalUse = { path: internalUse.path }
    }

    const billing = params.billing as Record<string, unknown> | undefined
    if (typeof billing?.billable === "boolean" && typeof billing.unit_cost === "number") {
        parameters.billing = { billable: billing.billable, unit_cost: billing.unit_cost }
    }

    if (Array.isArray(params.applicable_countries)
        && params.applicable_countries.every((item) => typeof item === "string")) {
        parameters.applicable_countries = [...params.applicable_countries] as string[]
    }

    const signature = params.signature as Record<string, unknown> | undefined
    const contractTypes = Array.isArray(signature?.contract_types)
        ? signature.contract_types.filter(
            (value): value is "agreement_only" | "guarantee_only" | "agreement_and_guarantee" =>
                value === "agreement_only"
                || value === "guarantee_only"
                || value === "agreement_and_guarantee",
        )
        : null
    if (typeof signature?.synchronous === "boolean" && contractTypes) {
        parameters.signature = {
            synchronous: signature.synchronous,
            contract_types: contractTypes,
        }
    }

    if (typeof params.verification_type === "string") {
        parameters.verification_type = params.verification_type
    }

    const setup = params.default_setup as Record<string, unknown> | undefined
    if (setup && typeof setup === "object") {
        const slots = Array.isArray(setup.slots)
            ? setup.slots.flatMap((value) => {
                if (!value || typeof value !== "object") return []
                const slot = value as Record<string, unknown>
                const guestType = slot.guest_type
                const status = slot.status_provider_id
                if (
                    typeof slot.name !== "string"
                    || typeof slot.order !== "number"
                    || !Number.isFinite(slot.order)
                    || (guestType !== "main_guest" && guestType !== "secondary_guest" && guestType !== "all")
                    || (status !== 8 && status !== 10)
                ) return []

                const slotParameters = slot.parameters && typeof slot.parameters === "object"
                    ? Object.fromEntries(
                        Object.keys(slot.parameters as Record<string, unknown>).map((key) => [key, ""]),
                    )
                    : undefined
                return [{
                    name: slot.name,
                    order: slot.order,
                    guest_type: guestType as "main_guest" | "secondary_guest" | "all",
                    status_provider_id: status as 8 | 10,
                    ...(slotParameters ? { parameters: slotParameters } : {}),
                }]
            })
            : []
        parameters.default_setup = { enabled: setup.enabled === true, slots }
    }

    return {
        id,
        name,
        description: typeof p.description === "string" ? p.description : null,
        order: typeof p.order === "number" && Number.isFinite(p.order) ? p.order : 0,
        statusProviderId: typeof p.statusProviderId === "number"
            ? p.statusProviderId
            : typeof p.status_provider_id === "number" ? p.status_provider_id : 0,
        parameters,
    }
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
        // Sanitizado y sin `...raw`: nada que el modelo no nombre entra al
        // estado del cliente. El `token` de la automatización se descarta a
        // propósito — ningún consumidor del frontend lee su valor (el que SÍ se
        // usa es el del override de listing, que se conserva).
        const provider = sanitizeProvider(raw.provider ?? null)
        return {
            uuid: raw.uuid,
            propertyUuid: raw.propertyUuid ?? raw.property_uuid ?? "",
            providerId,
            name: raw.name ?? "",
            guestType: raw.guestType ?? raw.guest_type ?? "all",
            executionOrder,
            parameters: raw.parameters ?? {},
            token: null,
            statusProviderId,
            deletedAt: raw.deletedAt ?? raw.deleted_at ?? null,
            provider,
            // `property` y `usageRecords` NO se copian: llegan como objetos crudos
            // del backend y ningún consumidor del frontend los lee en este flujo.
            // Dejarlos entrar contradecía la garantía de que solo entra lo que el
            // modelo nombra.
            isActive: statusProviderId === 8,
            // `providerSlug` es nuevo en la respuesta (reescritura del contrato de
            // `POST /properties`, 2026-08-12) y va PRIMERO: permite identificar el
            // provider sin depender del objeto `provider` sideloaded, que además el
            // backend serializa completo con sus credenciales adentro.
            providerName: raw.providerSlug ?? raw.provider_slug ?? raw.providerName
                ?? provider?.parameters?.slug ?? provider?.parameters?.internalUse?.path ?? null,
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
        const response = await apiClient.get<unknown>(url)
        return this.normalizeList(response)
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
        const response = await apiClient.get<unknown>(url)
        return this.normalizeList(response)
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
     * Digital Contract is optional and can be inactive. It is identified by
     * `provider.parameters.signature`, never by executionOrder.
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
     * Restores a soft-deleted automation. The backend returns it active (8) only
     * when it still has a provider; otherwise it remains inactive (10).
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

        const all: unknown[] = []
        for (let page = 1; page <= MAX_PAGES; page++) {
            const pageQs = new URLSearchParams(qs)
            pageQs.set("page", String(page))
            const res = await fetch(`${API_BASE}/providers?${pageQs}`, {
                headers: { Accept: "application/json", ...this.authHeader() },
                cache: "no-store",
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as ApiErrorResponse
                if (res.status === 401) handleSessionExpired()
                // A provider selector is a closed set. Returning a partial page after
                // an auth/network failure can make a valid configured provider look
                // deleted and must never be treated as a successful catalog load.
                throw new ApiError(res.status, body)
            }
            const json = await res.json()
            const items = Array.isArray(json?.data) ? json.data : []
            all.push(...items)

            const lastPage = Number(json?.meta?.last_page ?? 1)
            if (page >= lastPage) break
        }
        return all.flatMap((provider) => sanitizeProvider(provider) ?? [])
    }

    // ── Reservation Automation Status ────────────────────────────────────────

    /**
     * Normalizes a raw automation-status item, tolerating camelCase/snake_case.
     */
    private normalizeStatusItem(raw: any): AutomationStatusItem {
        const status: AutomationLiveStatus = raw.status ?? "not_started"
        const payload = raw.responsePayload ?? raw.response_payload ?? null
        const pdfPath = payload?.pdf_path ?? raw.contractPdfPath ?? raw.contract_pdf_path ?? null
        // Backend action flags (dispatch panel contract). Missing authorization
        // flags never fall back to client heuristics: these actions can bill.
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
            canManualDispatch: pick(raw.canManualDispatch, raw.can_manual_dispatch, false),
            // Conservadores a propósito: de estos depende habilitar acciones que
            // FACTURAN (el reenvío de PDF crea un consumo nuevo cada vez). Asumir
            // "completado" cuando el backend no lo dice ofrecería un cargo que
            // nadie autorizó.
            reservationCheckinCompleted: pick(raw.reservationCheckinCompleted, raw.reservation_checkin_completed, false),
            mainGuestCheckinCompleted: pick(raw.mainGuestCheckinCompleted, raw.main_guest_checkin_completed, false),
            // Autoritativos: el backend ya aplicó los once gates de despacho al
            // calcularlos. Sin el flag se asume `false` — inferirlo del estado
            // ofrecía un botón que el backend no autorizó, y el 422 llegaba
            // recién al pulsarlo.
            canDispatch: pick(raw.canDispatch, raw.can_dispatch, false),
            canRedispatch: pick(raw.canRedispatch, raw.can_redispatch, false),
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

    private normalizeUsageRecord(raw: any): AutomationUsageRecord {
        const rawError = raw.lastError ?? raw.last_error ?? null
        const lastError = typeof rawError === "string"
            ? rawError
            : rawError && typeof rawError === "object"
                ? {
                    message: typeof rawError.message === "string" ? rawError.message : "",
                    httpStatus: typeof (rawError.httpStatus ?? rawError.http_status) === "number"
                        ? (rawError.httpStatus ?? rawError.http_status)
                        : null,
                    // El body externo es para soporte backend. No entra al estado
                    // ni se muestra al PM: puede contener PII o credenciales.
                    httpBody: null,
                }
                : null
        const rawPayload = raw.responsePayload ?? raw.response_payload
        const responsePayload = rawPayload && typeof rawPayload === "object"
            ? Object.fromEntries(
                ["pdf_path", "skipped", "reason"]
                    .filter((key) => (rawPayload as Record<string, unknown>)[key] !== undefined)
                    .map((key) => [key, (rawPayload as Record<string, unknown>)[key]]),
            )
            : null

        return {
            id: Number(raw.id),
            status: raw.status,
            triggeredBy: raw.triggeredBy ?? raw.triggered_by ?? null,
            automationUuid: raw.automationUuid ?? raw.automation_uuid ?? null,
            automationName: raw.automationName ?? raw.automation_name ?? null,
            providerSlug: raw.providerSlug ?? raw.provider_slug ?? null,
            guestUuid: raw.guestUuid ?? raw.guest_uuid ?? null,
            billable: raw.billable === true,
            unitCost: raw.unitCost ?? raw.unit_cost ?? null,
            lastError,
            responsePayload,
            createdAt: raw.createdAt ?? raw.created_at ?? "",
            updatedAt: raw.updatedAt ?? raw.updated_at ?? "",
        }
    }

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
            return Array.isArray(items) ? items.map((item) => this.normalizeUsageRecord(item)) : []
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
     * Resends the Guest Report PDF regardless of its previous execution status.
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
     * Legacy convenience helper. Identity orders are stable, but non-identity
     * order is country-dependent; callers must not use this to identify a provider.
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
        const paProvider = sanitizeProvider(rawPa?.provider ?? null)
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
                    // El token de la automatización anidada no lo lee nadie.
                    token: null,
                    statusProviderId: rawPa.statusProviderId ?? rawPa.status_provider_id,
                    provider: paProvider,
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
