import { useAuthStore } from "@/lib/store/auth-store"
import { apiClient } from "@/lib/api-client"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL_HIT || process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1")
    .trim()
    .replace(/\/$/, '')
    .replace(/\/auth$/, '')
    .replace(/\/hitguest$/, '')

const getHeaders = () => {
    const state = useAuthStore.getState()
    const sessionToken = state.user?.token
    const envToken = (process.env.NEXT_PUBLIC_APP_API_TOKEN || "").trim()
    const token = sessionToken || envToken
    
    return {
        "Authorization": `Bearer ${token}`
    }
}

export interface CatalogOption {
    id: string
    name: string
    description?: string
    extra?: any
}

export class CatalogService {
    private async fetchCatalog(categoryName: string, lang: string = "es"): Promise<CatalogOption[]> {
        const currentLang = typeof window !== 'undefined' ? (navigator.language.split("-")[0] || lang) : lang;
        const url = `${API_BASE_URL}/catalogs?status[eq]=ACT&catalogCategoryName[eq]=${categoryName}`
        try {
            const response = await fetch(url, { 
                headers: {
                    ...getHeaders(),
                    "Accept-Language": currentLang,
                    "X-Locale": currentLang,
                    "X-App-Locale": currentLang
                } 
            })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const result = await response.json()
            console.log(`[CatalogService] Successfully fetched ${categoryName}`)
            const rawOptions = result.data || result

            return rawOptions.map((item: any) => {
                let parsedName = item.name || item.description || item.label || "Sin nombre";
                if (typeof parsedName === 'object' && parsedName !== null) {
                    parsedName = parsedName[currentLang] || parsedName.es || parsedName.en || Object.values(parsedName)[0] || "Sin nombre";
                }
                
                return {
                    id: String(item.uuid || item.id || item.value),
                    name: String(parsedName),
                    extra: item.extra || item.metadata || item
                }
            })
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

    async getRoomTypes(): Promise<CatalogOption[]> {
        return this.fetchCatalog("room_type")
    }

    async getAmenities(): Promise<CatalogOption[]> {
        return this.fetchCatalog("amenities")
    }

    async getCountries(): Promise<CatalogOption[]> {
        const lang = typeof window !== 'undefined' ? (navigator.language.split("-")[0] || "es") : "es";
        const url = `${API_BASE_URL}/countries`
        try {
            const response = await fetch(url, { 
                headers: {
                    ...getHeaders(),
                    "Accept-Language": lang,
                    "X-Locale": lang,
                    "X-App-Locale": lang
                } 
            })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const result = await response.json()
            const rawCountries = result.data || result
            if (!Array.isArray(rawCountries)) return []

            return rawCountries.map((c: any) => {
                let parsedName = c.name || c.es_name || c.en_name || "Sin nombre";
                if (typeof parsedName === 'object' && parsedName !== null) {
                    parsedName = parsedName[lang] || parsedName.es || parsedName.en || Object.values(parsedName)[0] || "Sin nombre";
                }

                return {
                    id: String(c.id || c.uuid || c.iso2 || c.iso3),
                    name: String(parsedName),
                    extra: {
                        ...c,
                        phone_prefix: c.phonecode || c.phone_prefix || c.dial_code || c.calling_code || c.indicative || ""
                    }
                }
            })
        } catch(e) {
            console.warn("Countries API failed", e)
            return []
        }
    }

    async getTimezones(): Promise<CatalogOption[]> {
        // Based on user: GET api/v1/catalogs/category/timezones
        const url = `${API_BASE_URL}/catalogs/category/timezones`
        try {
            const response = await fetch(url, { headers: getHeaders() })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const result = await response.json()
            const rawData = result.data || result
            
            if (!Array.isArray(rawData)) return []

            const allTimezones: CatalogOption[] = []
            
            // The API returns groups: [ { region: "...", timezones: [...] }, ... ]
            rawData.forEach((group: any) => {
                const groupTimezones = group.timezones || []
                if (Array.isArray(groupTimezones)) {
                    groupTimezones.forEach((tz: any) => {
                        allTimezones.push({
                            id: String(tz.id || tz.uuid || tz.timezone || tz.value || ""),
                            name: String(tz.name || tz.label || tz.timezone || "Sin nombre")
                        })
                    })
                }
            })
            
            return allTimezones
        } catch (error) {
            console.warn("Timezone API failed", error)
            return []
        }
    }
}

export const catalogService = new CatalogService()
