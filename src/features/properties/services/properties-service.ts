// Properties Service - Connects to real Kunas API
import {
    PropertyApiPayload,
    PropertyApiResponse,
    PropertyFormData,
    formDataToApiPayload,
    INITIAL_AUTOMATION_SEED,
} from "../types"
import { apiClient, handleSessionExpired } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError } from "@/types/api"

/** Image upload limits (mirrored by the backend, which is the final authority). */
export const PROPERTY_IMAGE_LIMITS = {
    maxPerUpload: 10,
    maxBytes: 5 * 1024 * 1024, // 5 MB
} as const

/**
 * Reads the gallery URLs from a PropertyResource, tolerating both the camelCase
 * (`picturesUrl`, per the API contract) and legacy snake_case (`pictures_url`)
 * shapes the backend may return. Always returns an array.
 */
export function extractPicturesUrl(property: PropertyApiResponse): string[] {
    return property.extra?.picturesUrl ?? property.extra?.pictures_url ?? []
}

class PropertiesService {
    
    // ── CREATE ──
    async create(data: PropertyFormData): Promise<PropertyApiResponse> {
        const basePayload: PropertyApiPayload = formDataToApiPayload(data)
        // Solo se siembra la configuración de identidad principal y queda
        // INACTIVA. El contrato digital es opcional: no debe existir hasta que el
        // PM decida configurarlo expresamente.
        const payload: PropertyApiPayload = {
            ...basePayload,
            automations: INITIAL_AUTOMATION_SEED,
        }
        const url = `${API_BASE}/properties`

        try {
            const response = await apiClient.post<any>(url, payload)
            return response?.data ?? response
        } catch (error: any) {
            console.error("[PropertiesService] Create error:", error)
            throw error
        }
    }

    // ── LIST ──
    async list(): Promise<PropertyApiResponse[]> {
        const url = `${API_BASE}/properties`

        try {
            const response = await apiClient.get<any>(url)
            
            // Handle different response structures (unwrapping .data if present)
            if (response?.data && Array.isArray(response.data)) {
                return response.data
            } else if (Array.isArray(response)) {
                return response
            }
            return []
        } catch (error: any) {
            console.error("[PropertiesService] List error:", error)
            throw error
        }
    }

    // ── GET BY UUID ──
    async getByUuid(uuid: string): Promise<PropertyApiResponse> {
        const url = `${API_BASE}/properties/${uuid}`

        try {
            const response = await apiClient.get<any>(url)
            
            // Debug: log raw response to verify which fields the backend persists
            console.log("🔍 [PropertiesService] RAW getByUuid response:", JSON.stringify(response, null, 2))
            
            // Handle different response structures
            if (response?.data) {
                return response.data
            } else if (response?.uuid) {
                return response
            } else {
                throw new Error("Invalid response structure from API")
            }
        } catch (error: any) {
            console.error("[PropertiesService] Get error:", error)
            throw error
        }
    }

    // ── UPDATE (full form) ──
    async update(uuid: string, data: PropertyFormData): Promise<PropertyApiResponse> {
        const payload = formDataToApiPayload({ ...data, uuid } as any)
        const url = `${API_BASE}/properties/${uuid}`

        try {
            const response = await apiClient.put<any>(url, payload)
            return response?.data ?? response
        } catch (error: any) {
            console.error("[PropertiesService] Update error:", error)
            throw error
        }
    }

    // ── PATCH (partial update, e.g. status toggle) ──
    async patch(uuid: string, fields: Record<string, any>): Promise<PropertyApiResponse> {
        const url = `${API_BASE}/properties/${uuid}`

        try {
            return await apiClient.patch<PropertyApiResponse>(url, fields)
        } catch (error: any) {
            console.error("[PropertiesService] Patch error:", error)
            throw error
        }
    }

    // ── DELETE ──
    async delete(uuid: string): Promise<void> {
        const url = `${API_BASE}/properties/${uuid}`

        try {
            await apiClient.delete<void>(url)
        } catch (error: any) {
            console.error("[PropertiesService] Delete error:", error)
            throw error
        }
    }

    // ── RESTORE ──
    async restore(uuid: string): Promise<PropertyApiResponse> {
        const url = `${API_BASE}/properties/${uuid}/restore`

        try {
            const response = await apiClient.post<any>(url, {})
            return response?.data ?? response
        } catch (error: any) {
            console.error("[PropertiesService] Restore error:", error)
            throw error
        }
    }

    // ── IMAGES (gallery) ──
    /**
     * Upload one or more images to a property's gallery (multipart).
     * Returns the updated PropertyApiResponse (read the new `extra.picturesUrl`).
     *
     * apiClient forces JSON, so we issue a raw fetch here: FormData must set its
     * own multipart boundary (no Content-Type header), and we attach the PM's
     * session token like every other account-scoped call.
     */
    async uploadImages(uuid: string, files: File[]): Promise<PropertyApiResponse> {
        const url = `${API_BASE}/properties/${uuid}/images`
        const formData = new FormData()
        files.forEach((file) => formData.append("images[]", file))

        const token = useAuthStore.getState().user?.token
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-Language": "es",
                "X-Locale": "es",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            console.error("[PropertiesService] uploadImages error:", res.status, json)
            // Mirror apiClient: a session-expiry 401 clears the session and
            // redirects to /login (this raw fetch bypasses apiClient's handling).
            if (res.status === 401) handleSessionExpired()
            throw new ApiError(res.status, json)
        }
        return json?.data ?? json
    }

    /**
     * Remove a single image from a property's gallery. Send the URL exactly as it
     * appears in `extra.picturesUrl`. Returns the updated PropertyApiResponse.
     */
    async deleteImage(uuid: string, imageUrl: string): Promise<PropertyApiResponse> {
        const url = `${API_BASE}/properties/${uuid}/images`
        try {
            const response = await apiClient.delete<any>(url, {
                body: JSON.stringify({ url: imageUrl }),
            })
            return response?.data ?? response
        } catch (error: any) {
            console.error("[PropertiesService] deleteImage error:", error)
            throw error
        }
    }
}

export const propertiesService = new PropertiesService()
