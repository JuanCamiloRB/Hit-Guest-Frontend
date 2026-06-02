// Properties Service - Connects to real Kunas API
import { 
    PropertyApiPayload, 
    PropertyApiResponse, 
    PropertyFormData, 
    formDataToApiPayload, 
} from "../types"
import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

class PropertiesService {
    
    // ── CREATE ──
    async create(data: PropertyFormData): Promise<PropertyApiResponse> {
        const payload: PropertyApiPayload = formDataToApiPayload(data)
        const url = `${API_BASE}/properties`

        try {
            return await apiClient.post<PropertyApiResponse>(url, payload)
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
        // Inject uuid so formDataToApiPayload knows this is an UPDATE and omits units
        const payload: PropertyApiPayload = formDataToApiPayload({ ...data, uuid } as any)
        const url = `${API_BASE}/properties/${uuid}`

        try {
            return await apiClient.put<PropertyApiResponse>(url, payload)
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
            const response = await apiClient.post<{ success: boolean; data: PropertyApiResponse }>(url, {})
            return response.data
        } catch (error: any) {
            console.error("[PropertiesService] Restore error:", error)
            throw error
        }
    }
}

export const propertiesService = new PropertiesService()
