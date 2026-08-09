const API_BASE_URL = typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL_GUEST?.replace("/auth", "") || "https://guest.hit.tools/api/v1").trim()
    : "/api/guest"

export interface CatalogOption {
    id: string
    name: string
    description?: string
    extra?: any
}

/**
 * Metadatos de país que `getCountries()` normaliza a partir de la respuesta
 * cruda (que trae los nombres en varias formas: `iso2`/`kod`/`code`,
 * `phonecode`/`phone_code`/`calling_code`). Todos opcionales a propósito: el
 * fallback local que se usa cuando la API falla solo trae algunos.
 */
export interface CountryExtra {
    iso2?: string
    iso3?: string
    emoji?: string
    phone_prefix?: string
    timezones?: string[]
}

/**
 * País ya normalizado. Se declara aparte de `CatalogOption` porque el `extra` de
 * un país SÍ tiene forma conocida — el check-in lee `extra.iso2` para pedir los
 * tipos de documento del país correcto, y con `extra?: any` cada pantalla que lo
 * consumía tenía que volver a escribir `(c: any)`.
 */
export interface CountryOption extends CatalogOption {
    extra: CountryExtra
}

/** Country-aware identification type (from GET /catalogs/identification-types). */
export interface IdentificationTypeOption {
    id: number
    name: string
    requiresBackImage: boolean
    applicableCountries: string[]
}

const cache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000
const inflight = new Map<string, Promise<any>>()

export class CatalogService {
    private async getWithAppToken<T>(url: string): Promise<T> {
        // X-Locale / Accept-Language tell the backend which language to return
        // catalog labels in. Without them it falls back to its default (English),
        // so identification types, etc. would come back as "Citizenship Card".
        const headers: Record<string, string> = {
            "Accept": "application/json",
            "Accept-Language": "es",
            "X-Locale": "es",
        }
        const res = await fetch(url, { headers, cache: "no-store" })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error((err as any).message || `HTTP ${res.status}`)
        }
        return res.json() as Promise<T>
    }

    /**
     * Wraps a fetch with in-memory cache (5min TTL) and request deduplication.
     * Multiple concurrent calls for the same key share a single network request.
     */
    private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
        const hit = cache.get(key)
        if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T

        const pending = inflight.get(key)
        if (pending) return pending as Promise<T>

        const promise = fetcher().then(data => {
            cache.set(key, { data, ts: Date.now() })
            inflight.delete(key)
            return data
        }).catch(err => {
            inflight.delete(key)
            throw err
        })
        inflight.set(key, promise)
        return promise
    }

    private async fetchCatalog(categoryName: string): Promise<CatalogOption[]> {
        return this.cached(`catalog:${categoryName}`, async () => {
            const url = `${API_BASE_URL}/catalogs?status[eq]=ACT&catalogCategoryName[eq]=${categoryName}`
            const result = await this.getWithAppToken<any>(url)
            console.log(`[CatalogService] Successfully fetched ${categoryName}`)
            const rawOptions = result.data || result
            return rawOptions.map((item: any) => ({
                id: String(item.uuid || item.id || item.value),
                name: item.name || item.description || item.label || "Sin nombre"
            }))
        }).catch(error => {
            console.warn(`Catalog API (${categoryName}) failed`, error)
            return []
        })
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

    /**
     * GET /catalogs/identification-types[?country=CO]
     * Country-aware identification types. Each item carries parameters.requiresBackImage
     * (whether the back of the document is needed) and parameters.applicableCountries.
     * Pass a country ISO code to filter to that country's valid types; omit for all.
     */
    async getIdentificationTypesV2(country?: string): Promise<IdentificationTypeOption[]> {
        const c = (country || "").trim().toUpperCase()
        const qs = c ? `?country=${encodeURIComponent(c)}` : ""
        return this.cached(`identTypesV2:${c || "all"}`, async () => {
            const url = `${API_BASE_URL}/catalogs/identification-types${qs}`
            const result = await this.getWithAppToken<any>(url)
            const raw = result.data || result
            return (Array.isArray(raw) ? raw : []).map((item: any): IdentificationTypeOption => {
                const params = item.parameters || {}
                return {
                    id: Number(item.id),
                    name: item.name || item.nameTranslations?.es || item.label || "Sin nombre",
                    requiresBackImage: params.requiresBackImage ?? params.requires_back_image ?? true,
                    applicableCountries: params.applicableCountries ?? params.applicable_countries ?? [],
                }
            })
        }).catch(error => {
            console.warn("Catalog API (identification-types) failed", error)
            return []
        })
    }

    async getStatusRecords(): Promise<CatalogOption[]> {
        return this.fetchCatalog("status_record")
    }

    /**
     * Fetches active catalog options by numeric category id.
     * Used by the dynamic check-in form: provider-declared `select` fields carry a
     * `catalog_category_id` (e.g. 8 = reason_for_trip) instead of a category name.
     * Options are returned `{ id, name }` with the Spanish label.
     */
    async getCatalogByCategoryId(categoryId: number): Promise<CatalogOption[]> {
        return this.cached(`catalogById:${categoryId}`, async () => {
            const url = `${API_BASE_URL}/catalogs?status[eq]=ACT&catalogCategoryId[eq]=${categoryId}`
            const result = await this.getWithAppToken<any>(url)
            const rawOptions = result.data || result
            return (Array.isArray(rawOptions) ? rawOptions : []).map((item: any) => ({
                id: String(item.id ?? item.uuid ?? item.value),
                name: item.name_translations?.es || item.nameTranslations?.es || item.name || item.description || "Sin nombre",
            }))
        }).catch(error => {
            console.warn(`Catalog API (categoryId=${categoryId}) failed`, error)
            return []
        })
    }

    async getCountries(): Promise<CountryOption[]> {
        return this.cached<CountryOption[]>("countries", async () => {
            const isServer = typeof window === "undefined"
            const url = isServer ? `${API_BASE_URL}/countries` : `/api/checkin/countries`

            let result: any
            if (isServer) {
                result = await this.getWithAppToken<any>(url)
            } else {
                // Client-side: forward the admin session token to the proxy so the
                // backend accepts the request. Falls back when called from guest flow.
                let sessionToken: string | null = null
                try {
                    const { useAuthStore } = await import("@/lib/store/auth-store")
                    sessionToken = useAuthStore.getState().user?.token ?? null
                } catch {
                    // guest context — no auth store
                }
                const headers: Record<string, string> = { "Accept": "application/json" }
                if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`
                result = await fetch(url, { headers, cache: "no-store" }).then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`)
                    return r.json()
                })
            }
            const list: Record<string, unknown>[] = Array.isArray(result) ? result : (result.data || [])
            console.log("[CatalogService] Countries loaded:", list.length)
            // El backend no es consistente en los nombres de estos campos según la
            // fuente, de ahí las cadenas de fallback. `str()` evita que un número
            // (algunas fuentes mandan `phonecode` numérico) se cuele como string.
            const str = (...candidates: unknown[]): string | undefined => {
                for (const c of candidates) {
                    if (typeof c === "string" && c) return c
                    if (typeof c === "number") return String(c)
                }
                return undefined
            }
            return list.map((c): CountryOption => ({
                id: str(c.id, c.uuid) ?? "",
                name: str(c.name, c.es_name) ?? "Sin nombre",
                extra: {
                    iso2: str(c.iso2, c.kod, c.code),
                    iso3: str(c.iso3),
                    emoji: str(c.emoji) ?? "",
                    phone_prefix: str(c.phonecode, c.phone_code, c.calling_code) ?? "",
                    timezones: Array.isArray(c.timezones) ? (c.timezones as string[]) : [],
                }
            }))
        }).catch(error => {
            console.error("[CatalogService] Countries API failed:", error)
            return [
                { id: "1", name: "Australia",  extra: { iso2: "AU", emoji: "🇦🇺", timezones: ["Australia/Sydney"] } },
                { id: "2", name: "Colombia",   extra: { iso2: "CO", emoji: "🇨🇴", timezones: ["America/Bogota"] } },
                { id: "3", name: "México",     extra: { iso2: "MX", emoji: "🇲🇽", timezones: ["America/Mexico_City"] } },
                { id: "4", name: "España",     extra: { iso2: "ES", emoji: "🇪🇸", timezones: ["Europe/Madrid"] } },
                { id: "5", name: "Argentina",  extra: { iso2: "AR", emoji: "🇦🇷", timezones: ["America/Argentina/Buenos_Aires"] } },
                { id: "6", name: "Estados Unidos", extra: { iso2: "US", emoji: "🇺🇸", timezones: ["America/New_York"] } },
            ]
        })
    }

    async getRoomTypes(): Promise<CatalogOption[]> {
        return this.fetchCatalog("room_type")
    }

    async getAmenities(): Promise<CatalogOption[]> {
        return this.fetchCatalog("amenities")
    }

    async getCurrencies(): Promise<CatalogOption[]> {
        return this.cached("currencies", async () => {
            const url = `${API_BASE_URL}/catalogs/category/currencies`
            const result = await this.getWithAppToken<any>(url)
            const rawOptions = result.data || result

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
            return Array.from(uniqueCurrencies.values())
        }).catch(error => {
            console.warn("Currencies API failed", error)
            return [{ id: "COP", name: "COP - Peso Colombiano" }]
        })
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

    /**
     * PMS / channel sources (`source_pms`, catalog_category_id = 12) — the
     * "origen" half of a property's or listing's external identifier
     * (`externalPmsIds[].sourcePmsId`).
     *
     * Goes through `getCatalogByCategoryId` instead of `fetchCatalog("source_pms")`
     * on purpose: that helper maps `item.uuid || item.id`, and this contract needs
     * the NUMERIC catalog id. Verified live response (ago 2026): 100 Airbnb,
     * 101 Booking.com, 134 KunasPMS — none of them carries a `uuid`.
     *
     * No hardcoded fallback, deliberately. `getReservationSources()` above shows
     * why: its 14/15/16 fallback never matched the real catalog and silently
     * routed data to the wrong channel. An empty list here means "no se pudo
     * cargar", and the UI says exactly that.
     */
    async getPmsSources(): Promise<CatalogOption[]> {
        return this.getCatalogByCategoryId(12)
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
        return this.cached("timezones", async () => {
            const url = `${API_BASE_URL}/catalogs/category/timezones`
            const result = await this.getWithAppToken<any>(url)
            const rawOptions = result.data || result

            if (Array.isArray(rawOptions) && rawOptions.length > 0 && (rawOptions[0].region || rawOptions[0].timezones)) {
                return rawOptions.map((row: any) => ({
                    group: row.region || row.name || "General",
                    options: (row.timezones || []).map((tz: any) => ({
                        id: String(tz.id || tz.value || tz.name),
                        name: String(tz.name || tz.label || "Sin nombre")
                    }))
                })).filter((g: any) => g.options.length > 0);
            }

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
        }).catch(error => {
            console.warn("Timezones API failed, using hardcoded fallback", error)
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
        })
    }
}

export const catalogService = new CatalogService()
