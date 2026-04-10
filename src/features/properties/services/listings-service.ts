// Listings Service - Handles individual unit persistence
import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

export interface ListingApiPayload {
    uuid?: string
    property_id?: number
    propertyUuid?: string
    name: string
    internal_name?: string
    internalName?: string      // Support camelCase
    room_type_id?: number
    roomTypeId?: number        // Support camelCase
    description?: string | null
    thumbnail_url?: string
    thumbnailUrl?: string      // Support camelCase
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    // Legacy support for internal mapping
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    price?: number
    total_price?: number
    start_price?: number
    extra?: any
    statusRecordId?: number
    status_record_id?: number
}

class ListingsService {
    
    // ── LIST ALL ──
    async list(): Promise<any[]> {
        const url = `${API_BASE}/listings`

        try {
            const response = await apiClient.get<any>(url)
            
            // API returns paginated structure: { data: [], links: {}, meta: {} }
            if (response?.data && Array.isArray(response.data)) {
                return response.data
            }
            if (Array.isArray(response)) {
                return response
            }
            return []
        } catch (error: any) {
            console.error("[ListingsService] List error:", error)
            return []
        }
    }

    // ── LIST BY PROPERTY ──
    async listByProperty(propertyUuid: string): Promise<any[]> {
        const url = `${API_BASE}/listings?propertyUuid[eq]=${propertyUuid}`

        try {
            const response = await apiClient.get<any>(url)
            
            // API returns paginated structure: { data: [], links: {}, meta: {} }
            // data array may be empty if no listings created via /listings endpoint
            if (response?.data && Array.isArray(response.data)) {
                return response.data
            }
            // Fallback: if response is a plain array
            if (Array.isArray(response)) {
                return response
            }
            return []
        } catch (error: any) {
            console.error("[ListingsService] List error:", error)
            return []
        }
    }

    // ── CREATE ──
    async create(data: ListingApiPayload): Promise<any> {
        const url = `${API_BASE}/listings`
        
        try {
            // Ensure numeric values and mapping for both camelCase and snake_case
            const payload = {
                ...data,
                propertyUuid: data.propertyUuid || (data as any).property_uuid,
                room_type_id: Number(data.room_type_id || (data as any).roomTypeId) || 1,
                internal_name: data.internal_name || (data as any).internalName,
                statusRecordId: Number(data.statusRecordId || data.status_record_id) || 6,
                contactEmail: data.contactEmail || data.contact_email,
                contactName: data.contactName || data.contact_name,
                contactPhone: data.contactPhone || data.contact_phone,
                // Ensure price is present in both top-level fields
                price: data.price || (data as any).startPrice,
                start_price: data.start_price || data.price || (data as any).startPrice || (data.extra as any)?.startPrice,
            }
            
            console.log("🚀 [ListingsService] ENVIANDO a Kunas API:", JSON.stringify(payload, null, 2))
            
            return await apiClient.post<any>(url, payload)
        } catch (error: any) {
            console.error("[ListingsService] Create error:", error)
            throw error
        }
    }

    // ── UPDATE ──
    async update(uuid: string, data: ListingApiPayload): Promise<any> {
        const url = `${API_BASE}/listings/${uuid}`
        
        try {
            const payload = {
                ...data,
                room_type_id: Number(data.room_type_id || (data as any).roomTypeId) || 1,
                internal_name: data.internal_name || (data as any).internalName,
                statusRecordId: Number(data.statusRecordId || data.status_record_id) || 6,
                contactEmail: data.contactEmail || data.contact_email,
                contactName: data.contactName || data.contact_name,
                contactPhone: data.contactPhone || data.contact_phone,
                price: data.price || (data as any).startPrice,
                start_price: data.start_price || data.price || (data as any).startPrice || (data.extra as any)?.startPrice,
            }
            return await apiClient.put<any>(url, payload)
        } catch (error: any) {
            console.error("[ListingsService] Update error:", error)
            throw error
        }
    }

    // ── DELETE ──
    async delete(uuid: string): Promise<void> {
        const url = `${API_BASE}/listings/${uuid}`
        
        try {
            await apiClient.delete<void>(url)
        } catch (error: any) {
            console.error("[ListingsService] Delete error:", error)
            throw error
        }
    }
}

export const listingsService = new ListingsService()
