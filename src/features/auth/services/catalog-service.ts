import { apiClient } from "@/lib/api-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL_HIT || "https://www.kunas.co/api/v1/auth"
const APP_API_TOKEN = process.env.NEXT_PUBLIC_APP_API_TOKEN

const DEFAULT_HEADERS = {
    "Authorization": `Bearer ${APP_API_TOKEN}`
}

export interface CatalogOption {
    id: string
    name: string
    description?: string
}

export class CatalogService {
    // Note: The user mentioned they will create these endpoints. 
    // I am setting up the structure with common naming conventions.

    async getPersonTypes(): Promise<CatalogOption[]> {
        try {
            // Using a generic catalog endpoint as placeholder
            const response = await fetch(`${API_URL}/catalogs/person-types`, {
                headers: DEFAULT_HEADERS
            })
            if (!response.ok) return [{ id: "1", name: "Individual" }, { id: "2", name: "Empresa" }]
            const data = await response.json()
            return data.data || data
        } catch (error) {
            console.warn("Catalog API failed, falling back to static options", error)
            return [
                { id: "1", name: "Individual" },
                { id: "2", name: "Empresa" }
            ]
        }
    }

    async getCountries(): Promise<CatalogOption[]> {
        try {
            const response = await fetch(`${API_URL}/catalogs/countries`, {
                headers: DEFAULT_HEADERS
            })
            if (!response.ok) return []
            const data = await response.json()
            return data.data || data
        } catch (error) {
            return []
        }
    }
}

export const catalogService = new CatalogService()
