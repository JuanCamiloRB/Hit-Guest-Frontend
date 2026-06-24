/**
 * Property Document Service — text documents per property with {{shortcode}}
 * substitution rendered against reservation data.
 *
 * Endpoints:
 *   GET    /property-document-types                                          → getTypes
 *   GET    /properties/{propertyUuid}/documents                             → list (paginated)
 *   GET    /properties/{propertyUuid}/documents/{documentUuid}              → get
 *   POST   /properties/{propertyUuid}/documents                             → create
 *   PATCH  /properties/{propertyUuid}/documents/{documentUuid}              → update
 *   DELETE /properties/{propertyUuid}/documents/{documentUuid}              → remove (soft)
 *   POST   /properties/{propertyUuid}/documents/{documentUuid}/restore      → restore
 *   GET    /reservations/{reservationUuid}/documents/{documentUuid}/render  → render
 *   GET    /reservations/{reservationUuid}/documents/{documentUuid}/pdf     → PDF (binary)
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE, CONFIG } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import type {
    DocumentType,
    PropertyDocument,
    CreatePropertyDocumentPayload,
    UpdatePropertyDocumentPayload,
    PropertyDocumentListResult,
    PaginationMeta,
} from "../types/document"

export interface DocumentListParams {
    propertyDocumentTypeId?: number
    statusRecordId?: number
    uuid?: string
    page?: number
    perPage?: number
}

class PropertyDocumentService {
    /** Authorization header preferring the session token, falling back to app token. */
    private authHeader(): Record<string, string> {
        const token = useAuthStore.getState().user?.token || CONFIG.APP_API_TOKEN
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    // ── Document types (catalog) ─────────────────────────────────────────────

    async getTypes(): Promise<DocumentType[]> {
        try {
            const res = await apiClient.get<any>(`${API_BASE}/property-document-types`, {
                suppressUnauthorizedRedirect: true,
            })
            const items = Array.isArray(res) ? res : res?.data ?? []
            return items as DocumentType[]
        } catch (error) {
            console.error("[PropertyDocumentService] getTypes error:", error)
            return []
        }
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    /**
     * Paginated list. apiClient unwraps `data`, so we read meta via a raw fetch
     * to preserve pagination info.
     */
    async list(propertyUuid: string, params: DocumentListParams = {}): Promise<PropertyDocumentListResult> {
        const qs = new URLSearchParams()
        if (params.propertyDocumentTypeId) qs.set("propertyDocumentTypeId[eq]", String(params.propertyDocumentTypeId))
        if (params.statusRecordId)         qs.set("statusRecordId[eq]", String(params.statusRecordId))
        if (params.uuid)                   qs.set("uuid[eq]", params.uuid)
        if (params.page)                   qs.set("page", String(params.page))
        if (params.perPage)                qs.set("per_page", String(params.perPage))

        const url = `${API_BASE}/properties/${propertyUuid}/documents${qs.toString() ? `?${qs}` : ""}`
        try {
            const res = await fetch(url, {
                headers: { Accept: "application/json", ...this.authHeader() },
                cache: "no-store",
            })
            if (!res.ok) {
                if (res.status === 404 || res.status === 401) return { items: [], meta: null }
                throw new Error(`HTTP ${res.status}`)
            }
            const json = await res.json()
            const items: PropertyDocument[] = Array.isArray(json?.data) ? json.data : []
            const meta: PaginationMeta | null = json?.meta ?? null
            return { items, meta }
        } catch (error) {
            console.error("[PropertyDocumentService] list error:", error)
            return { items: [], meta: null }
        }
    }

    async get(propertyUuid: string, documentUuid: string): Promise<PropertyDocument> {
        return apiClient.get<PropertyDocument>(
            `${API_BASE}/properties/${propertyUuid}/documents/${documentUuid}`,
        )
    }

    async create(
        propertyUuid: string,
        payload: CreatePropertyDocumentPayload,
    ): Promise<PropertyDocument> {
        return apiClient.post<PropertyDocument>(
            `${API_BASE}/properties/${propertyUuid}/documents`,
            payload,
        )
    }

    async update(
        propertyUuid: string,
        documentUuid: string,
        payload: UpdatePropertyDocumentPayload,
    ): Promise<PropertyDocument> {
        return apiClient.patch<PropertyDocument>(
            `${API_BASE}/properties/${propertyUuid}/documents/${documentUuid}`,
            payload,
        )
    }

    async remove(propertyUuid: string, documentUuid: string): Promise<void> {
        await apiClient.delete<void>(
            `${API_BASE}/properties/${propertyUuid}/documents/${documentUuid}`,
        )
    }

    async restore(propertyUuid: string, documentUuid: string): Promise<PropertyDocument> {
        return apiClient.post<PropertyDocument>(
            `${API_BASE}/properties/${propertyUuid}/documents/${documentUuid}/restore`,
        )
    }

    // ── Render + PDF (reservation context) ───────────────────────────────────

    /** Returns the document HTML with all shortcodes replaced with reservation data. */
    async render(reservationUuid: string, documentUuid: string): Promise<string> {
        const res = await apiClient.get<{ uuid: string; rendered: string }>(
            `${API_BASE}/reservations/${reservationUuid}/documents/${documentUuid}/render`,
        )
        return (res as any)?.rendered ?? ""
    }

    /**
     * Fetches the rendered PDF as a Blob and opens it in a new tab.
     * Returns the object URL so callers can revoke it if needed.
     */
    async openPdf(reservationUuid: string, documentUuid: string): Promise<void> {
        const url = `${API_BASE}/reservations/${reservationUuid}/documents/${documentUuid}/pdf`
        const res = await fetch(url, {
            headers: { Accept: "application/pdf", ...this.authHeader() },
            cache: "no-store",
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        window.open(objectUrl, "_blank")
        // Revoke after a delay so the new tab has time to load the blob.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    }
}

export const propertyDocumentService = new PropertyDocumentService()
