import "server-only"
import type { GeocodePlaceDetails } from "./address"

/**
 * Búsqueda de direcciones sin clave, contra Nominatim (OpenStreetMap).
 *
 * Es el modo nativo gratuito cuando no existe un proveedor comercial. Contra el
 * servidor público se ejecuta únicamente por una acción explícita del PM
 * (Enter/botón), nunca como autocomplete por pulsación. Una instancia propia o
 * administrada sí puede habilitar autocomplete mediante NOMINATIM_BASE_URL.
 *
 * ## Límites de uso (política de Nominatim)
 *
 * Es un servicio comunitario y gratuito: pide un `User-Agent` que identifique la
 * aplicación y un máximo aproximado de 1 petición por segundo. Por eso las
 * búsquedas se cachean en memoria — el mismo texto no se vuelve a pedir. Para un
 * flujo administrativo de alta de propiedades es suficiente; no serviría para
 * un buscador público de alto tráfico.
 */

/** Cómo se identifica esta app ante Nominatim, según su política de uso. */
const USER_AGENT = "HitGuest/1.0 (property address lookup; +https://hitguest.com)"
const BASE = (process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "")

/** El mismo texto no se vuelve a pedir dentro de esta ventana. */
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 200

export interface GeocodeSuggestion {
    placeId: string
    description: string
    /** Search already returns full address details; avoids a second public call. */
    details: GeocodePlaceDetails
}

/** Un resultado de Nominatim, con solo los campos que se leen. */
export interface NominatimItem {
    osm_type?: string
    osm_id?: number | string
    lat?: string
    lon?: string
    display_name?: string
    address?: Record<string, string>
}

// ── Parte pura (testeable sin red) ───────────────────────────────────────────

/**
 * Identificador estable de un lugar: la inicial del tipo OSM + su id, que es
 * justo el formato que espera el endpoint `lookup` (`N`odo, `W`ay, `R`elación).
 * Se usa como `placeId` para que el flujo de dos pasos del cliente
 * —sugerencias, y luego detalle del elegido— siga funcionando igual que con
 * Google, sin que el cliente sepa qué proveedor respondió.
 */
export function toPlaceId(item: NominatimItem): string | null {
    const prefix = (item.osm_type ?? "").charAt(0).toUpperCase()
    if (!prefix || !"NWR".includes(prefix)) return null
    if (item.osm_id == null || item.osm_id === "") return null
    return `${prefix}${item.osm_id}`
}

/** `true` si el id tiene la forma que `lookup` acepta. Evita reenviar basura. */
export function isNominatimPlaceId(placeId: string): boolean {
    return /^[NWR]\d+$/.test(placeId)
}

/**
 * Traduce un resultado de Nominatim al mismo shape que devuelve el detalle de
 * Google, para que el cliente no tenga que distinguir proveedores.
 *
 * La ciudad se busca en cascada a propósito: Nominatim la publica bajo claves
 * distintas según el tipo de localidad, y quedarse solo con `city` deja sin
 * ciudad a cualquier dirección de pueblo o suburbio.
 */
/**
 * Coordenada numérica, o `null` si falta.
 *
 * No se usa `Number()` a secas porque `Number("")` es **0**, no `NaN`: una
 * longitud ausente se habría convertido en cero, y una propiedad con un 0 por
 * error termina ubicada en mar abierto, que es justo el fallo que este flujo
 * intenta evitar. Vacío y espacios en blanco cuentan como ausente.
 */
function toCoordinate(raw: string | undefined): number | null {
    if (typeof raw !== "string" || raw.trim() === "") return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
}

export function mapPlaceDetails(item: NominatimItem): GeocodePlaceDetails {
    const address = item.address ?? {}
    const streetNumber = address.house_number ?? ""
    const streetName =
        address.road
        ?? address.pedestrian
        ?? address.residential
        ?? address.footway
        ?? address.path
        ?? ""
    const addressLine2 = address.unit ?? address.flat ?? address.apartment ?? ""
    return {
        lat: toCoordinate(item.lat),
        lng: toCoordinate(item.lon),
        formattedAddress: item.display_name ?? "",
        addressLine1: [streetNumber, streetName].filter(Boolean).join(" "),
        addressLine2,
        streetNumber,
        streetName,
        city:
            address.city
            ?? address.town
            ?? address.village
            ?? address.municipality
            ?? address.suburb
            ?? address.county
            ?? "",
        suburb:
            address.suburb
            ?? address.city_district
            ?? address.neighbourhood
            ?? address.quarter
            ?? "",
        state: address.state ?? address.region ?? "",
        postalCode: address.postcode ?? "",
        // Nominatim lo devuelve en minúsculas ("au"); el catálogo de países se
        // compara contra el ISO2 de Google, que llega en mayúsculas. Sin esto el
        // país no casaría y la zona horaria no se autocompletaría.
        countryCode: (address.country_code ?? "").toUpperCase(),
    }
}

// ── Acceso a la red ──────────────────────────────────────────────────────────

const searchCache = new Map<string, { at: number; suggestions: GeocodeSuggestion[] }>()

function readCache(key: string): GeocodeSuggestion[] | null {
    const hit = searchCache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        searchCache.delete(key)
        return null
    }
    return hit.suggestions
}

function writeCache(key: string, suggestions: GeocodeSuggestion[]): void {
    // Poda simple por antigüedad de inserción: `Map` conserva el orden, así que
    // la primera clave es la más vieja. Suficiente para un caché de este tamaño.
    if (searchCache.size >= CACHE_MAX_ENTRIES) {
        const oldest = searchCache.keys().next().value
        if (oldest !== undefined) searchCache.delete(oldest)
    }
    searchCache.set(key, { at: Date.now(), suggestions })
}

async function nominatimFetch(path: string): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        cache: "no-store",
    })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    return res.json()
}

/** Sugerencias para un texto libre. Devuelve [] ante cualquier fallo. */
export async function nominatimSearch(q: string): Promise<GeocodeSuggestion[]> {
    const key = q.toLowerCase()
    const cached = readCache(key)
    if (cached) return cached

    const params = new URLSearchParams({
        q,
        format: "jsonv2",
        addressdetails: "1",
        limit: "6",
    })
    const data = await nominatimFetch(`/search?${params.toString()}`)
    const items = Array.isArray(data) ? (data as NominatimItem[]) : []

    const suggestions = items
        .map((item) => {
            const placeId = toPlaceId(item)
            if (!placeId) return null
            return {
                placeId,
                description: item.display_name ?? "",
                details: mapPlaceDetails(item),
            }
        })
        .filter((s): s is GeocodeSuggestion => s !== null && s.description !== "")

    writeCache(key, suggestions)
    return suggestions
}

/** Detalle de un lugar ya elegido. `null` si el id no resuelve. */
export async function nominatimLookup(placeId: string): Promise<GeocodePlaceDetails | null> {
    if (!isNominatimPlaceId(placeId)) return null
    const params = new URLSearchParams({
        osm_ids: placeId,
        format: "jsonv2",
        addressdetails: "1",
    })
    const data = await nominatimFetch(`/lookup?${params.toString()}`)
    const items = Array.isArray(data) ? (data as NominatimItem[]) : []
    if (items.length === 0) return null
    return mapPlaceDetails(items[0])
}
