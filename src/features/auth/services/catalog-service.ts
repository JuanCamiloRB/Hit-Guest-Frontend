import { apiClient } from "@/lib/api-client"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL_GUEST?.replace("/auth", "") || "https://www.kunas.co/api/v1").trim()
const APP_API_TOKEN = (process.env.NEXT_PUBLIC_APP_API_TOKEN || "").trim()

const DEFAULT_HEADERS = {
    "Authorization": `Bearer ${APP_API_TOKEN}`
}

export interface CatalogOption {
    id: string
    name: string
    description?: string
    extra?: any
}

export class CatalogService {
    private async fetchCatalog(categoryName: string): Promise<CatalogOption[]> {
        const url = `${API_BASE_URL}/catalogs?status[eq]=ACT&catalogCategoryName[eq]=${categoryName}`
        try {
            const response = await fetch(url, { headers: DEFAULT_HEADERS })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

            const result = await response.json()
            console.log(`[CatalogService] Successfully fetched ${categoryName}`)
            const rawOptions = result.data || result

            return rawOptions.map((item: any) => ({
                id: String(item.uuid || item.id || item.value),
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

    async getCountries(): Promise<any[]> {
        const url = `${API_BASE_URL}/countries`
        console.log("[CatalogService] Fetching countries from:", url)
        try {
            const response = await fetch(url, { headers: DEFAULT_HEADERS })
            console.log("[CatalogService] Countries response status:", response.status)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const result = await response.json()
            const list: any[] = Array.isArray(result) ? result : (result.data || [])
            console.log("[CatalogService] Countries loaded:", list.length)
            return list.map((c: any) => ({
                id: String(c.id || c.uuid),
                name: c.name || c.es_name || "Sin nombre",
                extra: {
                    iso2: c.iso2 || c.kod || c.code,
                    iso3: c.iso3,
                    emoji: c.emoji || "",
                    phone_prefix: c.phonecode || c.phone_code || c.calling_code || "",
                    timezones: c.timezones || []
                }
            }))
        } catch (error) {
            console.error("[CatalogService] Countries API failed:", error)
            // Hardcoded common fallbacks
            return [
                { id: "1", name: "Australia",  extra: { iso2: "AU", emoji: "🇦🇺", timezones: ["Australia/Sydney"] } },
                { id: "2", name: "Colombia",   extra: { iso2: "CO", emoji: "🇨🇴", timezones: ["America/Bogota"] } },
                { id: "3", name: "México",     extra: { iso2: "MX", emoji: "🇲🇽", timezones: ["America/Mexico_City"] } },
                { id: "4", name: "España",     extra: { iso2: "ES", emoji: "🇪🇸", timezones: ["Europe/Madrid"] } },
                { id: "5", name: "Argentina",  extra: { iso2: "AR", emoji: "🇦🇷", timezones: ["America/Argentina/Buenos_Aires"] } },
                { id: "6", name: "Estados Unidos", extra: { iso2: "US", emoji: "🇺🇸", timezones: ["America/New_York"] } },
            ]
        }
    }

    async getRoomTypes(): Promise<CatalogOption[]> {
        return this.fetchCatalog("room_type")
    }

    async getAmenities(): Promise<CatalogOption[]> {
        return this.fetchCatalog("amenities")
    }

    async getCurrencies(): Promise<CatalogOption[]> {
        const url = `${API_BASE_URL}/catalogs/category/currencies`
        try {
            const response = await fetch(url, { headers: DEFAULT_HEADERS })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            
            const result = await response.json()
            const rawOptions = result.data || result
            
            console.log('[CatalogService] Raw currencies from API:', rawOptions.length, rawOptions)
            
            // Use Map to remove duplicates by code
            const uniqueCurrencies = new Map<string, CatalogOption>()
            rawOptions.forEach((item: any) => {
                const code = item.code || item.id
                if (!uniqueCurrencies.has(code)) {
                    uniqueCurrencies.set(code, {
                        id: code,
                        name: `${code} - ${item.name}`
                    })
                }
            })
            
            const finalList = Array.from(uniqueCurrencies.values())
            console.log('[CatalogService] Unique currencies after dedup:', finalList.length, finalList)
            
            return finalList
        } catch (error) {
            console.warn("Currencies API failed", error)
            return [{ id: "COP", name: "COP - Peso Colombiano" }]
        }
    }

    async getReservationSources(): Promise<CatalogOption[]> {
        const sources = await this.fetchCatalog("reservation_source")
        if (sources.length === 0) {
            return [
                { id: "14", name: "Airbnb" },
                { id: "15", name: "Booking.com" },
                { id: "16", name: "Directo" },
            ]
        }
        return sources
    }

    async getReasonsForTrip(): Promise<CatalogOption[]> {
        return this.fetchCatalog("reason_for_trip")
    }

    async getGenders(): Promise<CatalogOption[]> {
        return this.fetchCatalog("gender")
    }

    async getPropertyTypes(): Promise<CatalogOption[]> {
        return this.fetchCatalog("property_type")
    }

    async getTimezonesGrouped(): Promise<{group: string, options: CatalogOption[]}[]> {
        const url = `${API_BASE_URL}/catalogs/category/timezones`
        console.log("[CatalogService] Fetching timezones from:", url)
        try {
            const response = await fetch(url, { headers: DEFAULT_HEADERS })
            console.log("[CatalogService] Timezones response status:", response.status)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            
            const result = await response.json()
            const rawOptions = result.data || result
            console.log("[CatalogService] Timezones raw options structure type:", Array.isArray(rawOptions) ? "Array" : typeof rawOptions)
            
            // Specific handling for HitGuest grouped timezone structure:
            // Expects: [{ region: "Africa", timezones: [{ id, name, offset }, ...] }, ...]
            if (Array.isArray(rawOptions) && rawOptions.length > 0 && (rawOptions[0].region || rawOptions[0].timezones)) {
                console.log("[CatalogService] Using documented regional grouping structure")
                return rawOptions.map((row: any) => ({
                    group: row.region || row.name || "General",
                    options: (row.timezones || []).map((tz: any) => ({
                        id: String(tz.id || tz.value || tz.name),
                        name: String(tz.name || tz.label || "Sin nombre")
                    }))
                })).filter(g => g.options.length > 0);
            }

            // Fallback for flat array or other formats
            const groupedMap = new Map<string, CatalogOption[]>();
            const optionsArray = Array.isArray(rawOptions) ? rawOptions : [];

            optionsArray.forEach((item: any, index: number) => {
                const id = String(typeof item === 'string' ? item : (item.id || item.value || item.uuid || item.name || `tz-${index}`));
                const name = String(typeof item === 'string' ? item : (item.name || item.label || item.description || item.value || "Sin nombre"));
                
                let groupName = "GENERAL";
                if (id.includes('/')) {
                    groupName = id.split('/')[0].toUpperCase();
                } else {
                    const gmtMatch = name.match(/\(GMT[+-]\d{2}:\d{2}\)/);
                    if (gmtMatch) groupName = gmtMatch[0].replace(/[()]/g, '');
                }

                const current = groupedMap.get(groupName) || [];
                current.push({ id, name });
                groupedMap.set(groupName, current);
            });

            if (groupedMap.size === 0) throw new Error("Could not parse any timezones");

            return Array.from(groupedMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([group, options]) => ({
                    group,
                    options: options.sort((a, b) => a.name.localeCompare(b.name))
                }));
        } catch (error) {
            console.warn("Timezones API failed, using hardcoded fallback", error)
            // Comprehensive hardcoded fallback
            return [
                { group: "América", options: [
                    { id: "America/Bogota", name: "America/Bogota (Colombia)" },
                    { id: "America/New_York", name: "America/New_York (US Est)" },
                    { id: "America/Chicago", name: "America/Chicago (US Cen)" },
                    { id: "America/Denver", name: "America/Denver (US Mtn)" },
                    { id: "America/Los_Angeles", name: "America/Los_Angeles (US Pac)" },
                    { id: "America/Mexico_City", name: "America/Mexico_City" },
                    { id: "America/Argentina/Buenos_Aires", name: "America/Buenos_Aires" },
                    { id: "America/Santiago", name: "America/Santiago" },
                    { id: "America/Lima", name: "America/Lima" },
                ]},
                { group: "Europa", options: [
                    { id: "Europe/Madrid", name: "Europe/Madrid" },
                    { id: "Europe/London", name: "Europe/London" },
                    { id: "Europe/Paris", name: "Europe/Paris" },
                ]},
                { group: "Australia", options: [
                    { id: "Australia/Sydney", name: "Australia/Sydney" },
                    { id: "Australia/Melbourne", name: "Australia/Melbourne" },
                    { id: "Australia/Brisbane", name: "Australia/Brisbane" },
                    { id: "Australia/Perth", name: "Australia/Perth" },
                ]},
            ]
        }
    }
}

export const catalogService = new CatalogService()
