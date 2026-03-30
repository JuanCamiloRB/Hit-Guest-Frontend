// Properties Service - Connects to real Kunas API
// POST /v1/properties - Create property
// GET /v1/properties - List properties
// GET /v1/properties/:uuid - Get property
// PUT /v1/properties/:uuid - Update property

import { 
    PropertyApiPayload, 
    PropertyApiResponse, 
    PropertyFormData, 
    formDataToApiPayload, 
    apiResponseToFormData 
} from "../types"
import { apiClient } from "@/lib/api-client"
import { useAuthStore } from "@/lib/store/auth-store"

const API_BASE_HITGUEST = (process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1").trim()
    .replace(/\/$/, '')
    .replace(/\/auth$/, '')
    .replace(/\/hitguest$/, '')
const USE_MOCK = (process.env.NEXT_PUBLIC_ENABLE_MOCKS || "").trim() === "true"

// Get auth token for headers
const getAuthHeaders = () => {
    const state = useAuthStore.getState()
    const sessionToken = state.user?.token
    const envToken = (process.env.NEXT_PUBLIC_APP_API_TOKEN || "").trim()
    
    // Prioritize session token from login
    const token = sessionToken || envToken
    
    console.log("[PropertiesService] Auth Debug:", {
        hasSessionToken: !!sessionToken,
        hasEnvToken: !!envToken,
        usingTokenSource: sessionToken ? "session" : (envToken ? "env" : "none"),
        tokenPreview: token ? `${token.substring(0, 10)}...` : "none"
    })

    const headers: Record<string, string> = {}
    if (token) {
        headers["Authorization"] = `Bearer ${token}`
    }
    return headers
}

// Get current user UUID from auth store (must be called within React context or passed as param)
const getUserUuid = (): string | null => {
    const state = useAuthStore.getState()
    return state.user?.uuid || state.user?.id || null
}

class PropertiesService {
    
    // ── CREATE ──
    async create(data: PropertyFormData): Promise<PropertyApiResponse> {
        const userUuid = getUserUuid()
        if (!userUuid && !USE_MOCK) {
            throw new Error("No se encontró el usuario. Por favor, inicia sesión.")
        }

        const payload: PropertyApiPayload = formDataToApiPayload(
            data, 
            userUuid || "mock-user-uuid"
        )

        if (USE_MOCK) {
            await new Promise((r) => setTimeout(r, 1500))
            console.log("[MOCK] Creating property:", payload)
            return this.mockCreate(payload)
        }

        const url = `${API_BASE_HITGUEST}/properties`
        console.log("[PropertiesService] POST", url, payload)

        try {
            const response = await apiClient.post<PropertyApiResponse>(url, payload, {
                headers: getAuthHeaders(),
            })
            console.log("[PropertiesService] Created:", response)
            return response
        } catch (error: any) {
            console.error("[PropertiesService] Create error:", error)
            throw error
        }
    }

    // ── LIST ──
    async list(): Promise<PropertyApiResponse[]> {
        if (USE_MOCK) {
            await new Promise((r) => setTimeout(r, 500))
            return this.mockList()
        }

        const url = `${API_BASE_HITGUEST}/properties`
        console.log("[PropertiesService] GET", url)

        try {
            const response = await apiClient.get<PropertyApiResponse[]>(url, {
                headers: getAuthHeaders(),
            })
            return response
        } catch (error: any) {
            console.error("[PropertiesService] List error:", error)
            throw error
        }
    }

    // ── GET BY UUID ──
    async getByUuid(uuid: string): Promise<PropertyApiResponse> {
        if (USE_MOCK) {
            await new Promise((r) => setTimeout(r, 500))
            const properties = await this.mockList()
            const found = properties.find((p) => p.uuid === uuid)
            if (!found) throw new Error("Propiedad no encontrada")
            return found
        }

        const url = `${API_BASE_HITGUEST}/properties/${uuid}`
        console.log("[PropertiesService] GET", url)

        try {
            const response = await apiClient.get<PropertyApiResponse>(url, {
                headers: getAuthHeaders(),
            })
            return response
        } catch (error: any) {
            console.error("[PropertiesService] Get error:", error)
            throw error
        }
    }

    // ── UPDATE ──
    async update(uuid: string, data: PropertyFormData): Promise<PropertyApiResponse> {
        const userUuid = getUserUuid()
        const payload: PropertyApiPayload = formDataToApiPayload(
            data,
            userUuid || "mock-user-uuid"
        )

        if (USE_MOCK) {
            await new Promise((r) => setTimeout(r, 1500))
            console.log("[MOCK] Updating property:", uuid, payload)
            return this.mockUpdate(uuid, payload)
        }

        const url = `${API_BASE_HITGUEST}/properties/${uuid}`
        console.log("[PropertiesService] PUT", url, payload)

        try {
            const response = await apiClient.put<PropertyApiResponse>(url, payload, {
                headers: getAuthHeaders(),
            })
            console.log("[PropertiesService] Updated:", response)
            return response
        } catch (error: any) {
            console.error("[PropertiesService] Update error:", error)
            throw error
        }
    }

    // ── DELETE ──
    async delete(uuid: string): Promise<void> {
        if (USE_MOCK) {
            await new Promise((r) => setTimeout(r, 1000))
            console.log("[MOCK] Deleted property:", uuid)
            return
        }

        const url = `${API_BASE_HITGUEST}/properties/${uuid}`
        console.log("[PropertiesService] DELETE", url)

        try {
            await apiClient.delete<void>(url, {
                headers: getAuthHeaders(),
            })
        } catch (error: any) {
            console.error("[PropertiesService] Delete error:", error)
            throw error
        }
    }

    // ── MOCK IMPLEMENTATIONS ──
    private mockList(): PropertyApiResponse[] {
        return [
            {
                id: 1,
                uuid: "018cac04-4119-710b-a52f-8610b4b68aa3",
                user_id: 1,
                name: "Hotel Oasis Cartagena",
                description: "Un oasis de tranquilidad en el corazón de Cartagena",
                email: "info@hoteloasis.com",
                phone: "+573001234567",
                address: "Calle 10 # 5-20",
                address_detail: null,
                city: "Cartagena",
                state: "Bolívar",
                country_id: 48,
                geo_location: "10.3910,-75.4794",
                timezone: "America/Bogota",
                status_record_id: 6,
                extra: {
                    picturesUrl: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994"],
                    checkIn: "15:00",
                    checkOut: "11:00",
                    amenities: [47, 50, 54],
                    wifiDetails: { network: "HotelOasis", password: "welcome2024" },
                    type: "HOTEL",
                    thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994",
                    startPrice: 250000,
                    currency: "COP",
                },
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
            },
            {
                id: 2,
                uuid: "018cac04-4119-710b-a52f-8610b4b68aa4",
                user_id: 1,
                name: "Apartamentos El Poblado",
                description: "Modernos apartamentos en Medellín",
                email: "reservas@elpoblado.com",
                phone: "+573002345678",
                address: "Carrera 43 # 12-10",
                address_detail: "Torre A, Apto 301",
                city: "Medellín",
                state: "Antioquia",
                country_id: 48,
                geo_location: "6.2442,-75.5812",
                timezone: "America/Bogota",
                status_record_id: 6,
                extra: {
                    picturesUrl: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688"],
                    checkIn: "14:00",
                    checkOut: "12:00",
                    amenities: [79, 87],
                    type: "APARTAHOTEL",
                    thumbnailUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
                    startPrice: 450000,
                    currency: "COP",
                },
                created_at: "2024-01-15T00:00:00Z",
                updated_at: "2024-02-01T00:00:00Z",
            },
        ]
    }

    private mockCreate(payload: PropertyApiPayload): PropertyApiResponse {
        const now = new Date().toISOString()
        return {
            id: Date.now(),
            uuid: `mock-uuid-${Date.now()}`,
            user_id: 1, // Mock usually uses numeric IDs
            name: payload.name,
            description: payload.description || null,
            email: payload.email,
            phone: payload.phone || null,
            address: payload.address,
            address_detail: payload.addressDetail || null,
            city: payload.city,
            state: payload.state,
            country_id: payload.countryId,
            geo_location: payload.latitude && payload.longitude 
                ? `${payload.latitude},${payload.longitude}` 
                : null,
            timezone: payload.timezone || null,
            status_record_id: payload.statusRecordId,
            extra: payload.extra || {},
            external_pms_ids: payload.externalPmsIds?.map((id: any) => ({
                source_pms_id: id.sourcePmsId,
                external_id: id.externalId,
            })) || [],
            created_at: now,
            updated_at: now,
        }
    }

    private mockUpdate(uuid: string, payload: PropertyApiPayload): PropertyApiResponse {
        const mockList = this.mockList()
        const existing = mockList.find((p) => p.uuid === uuid) || mockList[0]
        return {
            ...existing,
            ...payload,
            id: existing.id,
            uuid: uuid,
            user_id: existing.user_id, // Use existing user_id
            updated_at: new Date().toISOString(),
        }
    }
}

export const propertiesService = new PropertiesService()
