import { apiClient } from "@/lib/api-client"

const API_BASE_URL = "https://www.kunas.co/api/v1"
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
    private async fetchCatalog(categoryName: string): Promise<CatalogOption[]> {
        const url = `${API_BASE_URL}/catalogs?status[eq]=ACT&catalogCategoryName[eq]=${categoryName}`
        try {
            const response = await fetch(url, { headers: DEFAULT_HEADERS })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const result = await response.json()
            const rawOptions = result.data || result

            return rawOptions.map((item: any) => ({
                id: item.uuid || item.id || String(item.value),
                name: item.name || item.description || item.label || "Sin nombre"
            }))
        } catch (error) {
            console.warn(`Catalog API (${categoryName}) failed`, error)
            return []
        }
    }

    async getPersonTypes(): Promise<CatalogOption[]> {
        const types = await this.fetchCatalog("person_type")
        if (types.length === 0) {
            return [
                { id: "1", name: "Individual" },
                { id: "2", name: "Empresa" }
            ]
        }
        return types
    }

    async getIdentificationTypes(): Promise<CatalogOption[]> {
        return this.fetchCatalog("identification_type")
    }

    async getStatusRecords(): Promise<CatalogOption[]> {
        return this.fetchCatalog("status_record")
    }

    async getCountries(): Promise<CatalogOption[]> {
        return this.fetchCatalog("country")
    }
}

export const catalogService = new CatalogService()
