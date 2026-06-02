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
        const url = `${API_BASE}/listings?propertyUuid=${propertyUuid}`

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
                // Duplicate fields to snake_case to prevent backend nulls
                property_uuid: data.propertyUuid || (data as any).property_uuid,
                propertyUuid: data.propertyUuid || (data as any).property_uuid,
                room_type_id: Number(data.room_type_id || (data as any).roomTypeId) || 1,
                roomTypeId: Number(data.room_type_id || (data as any).roomTypeId) || 1,
                internal_name: data.internal_name || (data as any).internalName,
                internalName: data.internal_name || (data as any).internalName,
                status_record_id: Number(data.statusRecordId || data.status_record_id) || 6,
                statusRecordId: Number(data.statusRecordId || data.status_record_id) || 6,
                contact_email: data.contactEmail || data.contact_email,
                contactEmail: data.contactEmail || data.contact_email,
                contact_name: data.contactName || data.contact_name,
                contactName: data.contactName || data.contact_name,
                contact_phone: data.contactPhone || data.contact_phone,
                contactPhone: data.contactPhone || data.contact_phone,
                thumbnail_url: data.thumbnail_url || data.thumbnailUrl,
                thumbnailUrl: data.thumbnail_url || data.thumbnailUrl,
                // Ensure price is present in both top-level fields
                price: data.price || (data as any).startPrice || (data.extra as any)?.startPrice,
                start_price: data.start_price || data.price || (data as any).startPrice || (data.extra as any)?.startPrice,
                extra: {
                    ...(data.extra || {}),
                    startPrice: (data.extra as any)?.startPrice || data.price || data.start_price || 0,
                    currency: (data.extra as any)?.currency || "COP"
                }
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
                roomTypeId: Number(data.room_type_id || (data as any).roomTypeId) || 1,
                internal_name: data.internal_name || (data as any).internalName,
                internalName: data.internal_name || (data as any).internalName,
                status_record_id: Number(data.statusRecordId || data.status_record_id) || 6,
                statusRecordId: Number(data.statusRecordId || data.status_record_id) || 6,
                contact_email: data.contactEmail || data.contact_email,
                contactEmail: data.contactEmail || data.contact_email,
                contact_name: data.contactName || data.contact_name,
                contactName: data.contactName || data.contact_name,
                contact_phone: data.contactPhone || data.contact_phone,
                contactPhone: data.contactPhone || data.contact_phone,
                thumbnail_url: data.thumbnail_url || data.thumbnailUrl,
                thumbnailUrl: data.thumbnail_url || data.thumbnailUrl,
                price: data.price || (data as any).startPrice || (data.extra as any)?.startPrice,
                start_price: data.start_price || data.price || (data as any).startPrice || (data.extra as any)?.startPrice,
                extra: {
                    ...(data.extra || {}),
                    startPrice: (data.extra as any)?.startPrice || data.price || data.start_price || 0,
                    currency: (data.extra as any)?.currency || "COP"
                }
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
