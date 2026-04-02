// Listings Service - Handles individual unit persistence
import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

export interface ListingApiPayload {
    uuid?: string
    property_id?: number
    propertyUuid?: string
    name: string
    internal_name?: string
    room_type_id: number
    description?: string | null
    thumbnail_url?: string
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
    
    // ── LIST BY PROPERTY ──
    async listByProperty(propertyUuid: string): Promise<any[]> {
        // Correct endpoint discovered through API testing
        const url = `${API_BASE}/listings?propertyUuid=${propertyUuid}`

        try {
            const response = await apiClient.get<any>(url)
            
            // Handle pagination unwrapping
            if (response?.data && Array.isArray(response.data)) {
                return response.data
            }
            return []
        } catch (error: any) {
            console.error("[ListingsService] List error:", error)
            return [] // Return empty list rather than failing
        }
    }

    // ── CREATE ──
    async create(data: ListingApiPayload): Promise<any> {
        const url = `${API_BASE}/listings`
        
        try {
            // Ensure numeric values for IDs and Prices
            // Mapping to camelCase as required by actual API feedback
            const payload = {
                ...data,
                propertyUuid: data.propertyUuid,
                room_type_id: Number(data.room_type_id) || 1,
                statusRecordId: Number(data.statusRecordId || data.status_record_id) || 6, // 6 is Active in this API
                contactEmail: data.contactEmail || data.contact_email,
                contactName: data.contactName || data.contact_name,
                contactPhone: data.contactPhone || data.contact_phone,
            }
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
                room_type_id: Number(data.room_type_id) || 1,
                statusRecordId: Number(data.statusRecordId || data.status_record_id) || 6,
                contactEmail: data.contactEmail || data.contact_email,
                contactName: data.contactName || data.contact_name,
                contactPhone: data.contactPhone || data.contact_phone,
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
