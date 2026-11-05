import { bffFetch } from "@/lib/bff-client"
import { createStaleCache } from "@/lib/stale-cache"
import type { Property, Unit } from "@/types"
import { derivePropertyBadges, type PropertyAutomationOverviewRow, type PropertyBadge } from "./property-badges"
import { readPropertyTypeId } from "./property-type"
import { apiResponseToFormData } from "../types"

/** A listing plus the raw API fields the listings table reads (lock id, locale…). */
export interface PortfolioListing extends Unit {
    /** Lock identifier configured for this listing, when the PM set one. */
    lockId: string | null
}

/** Resumen por propiedad para las tarjetas. `badges: null` = no se pudo saber. */
export interface PropertyOverview {
    activeListings: number
    badges: PropertyBadge[] | null
}

export interface Portfolio {
    properties: Property[]
    listings: PortfolioListing[]
    /** Por uuid de propiedad: alojamientos activos e insignias de automatizaciones. */
    overview: Record<string, PropertyOverview>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AggregatedResponse = {
    properties: any[]
    listings: any[]
    automationsByProperty?: Record<string, PropertyAutomationOverviewRow[] | null>
}

function readExtra(raw: any): Record<string, any> {
    return raw.extra ?? {}
}

export function toProperty(raw: any, index: number): Property {
    const formData = apiResponseToFormData(raw)
    const extra = readExtra(raw)
    const isActive = formData.statusRecordId === 1 || formData.statusRecordId === 6

    return {
        id: raw.uuid || String(index + 1),
        uuid: raw.uuid,
        name: formData.name,
        description: formData.description || "",
        email: formData.email,
        phone: formData.phone,
        address: {
            line1: formData.address,
            city: formData.city,
            country: "Colombia",
        },
        address_detail: formData.addressDetail,
        city: formData.city,
        state: formData.state,
        country_id: formData.countryId,
        geo_location:
            formData.latitude && formData.longitude
                ? `${formData.latitude},${formData.longitude}`
                : null,
        timezone: formData.timezone,
        status_record_id: formData.statusRecordId,
        status: isActive ? "ACTIVE" : "INACTIVE",
        // "" = sin tipo informado (la tarjeta lo dice); nunca un id inventado.
        type: String(readPropertyTypeId(raw) ?? ""),
        thumbnailUrl: formData.thumbnailUrl,
        created_at: raw.createdAt,
        updated_at: raw.updatedAt,
        extra: {
            ...extra,
            propertyTypeId: readPropertyTypeId(raw),
            thumbnailUrl: formData.thumbnailUrl,
        },
    } as unknown as Property
}

export function toListing(raw: any, index: number): PortfolioListing {
    const extra = readExtra(raw)
    const price = Number(
        raw.price || raw.start_price || raw.startPrice || raw.total_price || extra.startPrice || 0,
    )
    // Activo si cualquiera de las formas del estado lo dice (la tabla de
    // alojamientos siempre lo leyó así).
    const isActive = [raw.statusRecordId, raw.status_record_id, raw.statusRecord?.id].some((id) => id === 1 || id === 6)
    const lockId = extra.lockId ?? extra.lock_id ?? extra.ttlockId ?? raw.lockId

    return {
        id: raw.uuid || String(index + 1),
        uuid: raw.uuid,
        propertyId:
            raw._propertyUuid || raw.propertyUuid || raw.property_uuid || raw.property_id || "",
        name: raw.name ?? "",
        number: raw.internalName || raw.internal_name || "",
        type: "ENTIRE_PLACE",
        // Sin capacidad declarada (o 0) se asume 2, como siempre mostró la tabla.
        capacity: Number(extra.maxOccupancy || extra.max_occupancy || raw.maxOccupancy || 2),
        amenities: [],
        pricePerNight: price,
        status: isActive ? "ACTIVE" : "INACTIVE",
        inheritWifi: false,
        lockId: lockId ? String(lockId) : null,
    }
}

/**
 * Resumen por propiedad: alojamientos activos + insignias de automatizaciones
 * encendidas. Solo lo que el backend afirma: un fetch de automations caído
 * llega como `null` y la tarjeta no muestra insignias (ni la ausencia de
 * cerradura) en vez de afirmar «nada configurado».
 */
function buildOverview(response: AggregatedResponse, listings: PortfolioListing[]): Record<string, PropertyOverview> {
    const autoMap = response.automationsByProperty ?? {}
    const activeCounts: Record<string, number> = {}
    for (const unit of listings) {
        if (unit.status === "ACTIVE" && unit.propertyId) {
            activeCounts[unit.propertyId] = (activeCounts[unit.propertyId] ?? 0) + 1
        }
    }
    const overview: Record<string, PropertyOverview> = {}
    const propertyUuids = new Set<string>([
        ...(response.properties ?? []).map((p) => String(p.uuid)),
        ...Object.keys(autoMap),
    ])
    for (const uuid of propertyUuids) {
        overview[uuid] = {
            activeListings: activeCounts[uuid] ?? 0,
            badges: derivePropertyBadges(autoMap[uuid] ?? null),
        }
    }
    return overview
}

/**
 * Las propiedades solas: liviano, pinta las tarjetas enseguida. Va aparte del
 * portafolio a propósito: ese hace en servidor una consulta de alojamientos y
 * otra de automatizaciones POR PROPIEDAD, y esperarlo retrasaría la primera
 * pintura.
 */
export const propertiesCache = createStaleCache(async (): Promise<Property[]> => {
    const response = await bffFetch<{ data?: any[] }>("/api/bff/properties")
    return (response.data ?? []).map(toProperty)
})

/**
 * El portafolio agregado (propiedades + alojamientos + resumen). Lo comparten
 * Propiedades (pestaña Alojamientos, conteos, insignias) y el panel de iCal.
 */
export const portfolioCache = createStaleCache(async (): Promise<Portfolio> => {
    const response = await bffFetch<AggregatedResponse>("/api/bff/properties-with-listings")
    const listings = (response.listings ?? []).map(toListing)
    return {
        properties: (response.properties ?? []).map(toProperty),
        listings,
        overview: buildOverview(response, listings),
    }
})

/**
 * Tras crear, editar o borrar una propiedad o un alojamiento, lo guardado se
 * sabe incorrecto: la próxima pantalla arranca limpia y pide de nuevo.
 */
export function invalidatePropertiesCaches(): void {
    propertiesCache.invalidate()
    portfolioCache.invalidate()
}

/** Solo para tests. */
export function resetPropertiesCaches(): void {
    propertiesCache.reset()
    portfolioCache.reset()
}
