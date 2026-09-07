import type { ExternalPmsId } from "../types"
import type { ListingApiPayload } from "../services/listings-service"
import { toExternalPmsIdsPayload } from "./external-pms-ids"

export interface ListingDraft {
    name?: string | null
    internalName?: string | null
    roomTypeId?: string | number | null
    description?: string | null
    thumbnailUrl?: string | null
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    isActive?: boolean
    price?: string | number | null
    externalPmsIds?: ExternalPmsId[]
    extra?: Record<string, unknown> & {
        inheritWifi?: boolean
        inheritSchedule?: boolean
        inheritPolicies?: boolean
        inheritAmenities?: boolean
        amenities?: unknown
        wifiDetails?: unknown
        checkIn?: unknown
        checkOut?: unknown
        cancellationPolicy?: unknown
    }
}

/**
 * `extra.amenities` se ESCRIBE con ids (`[46, 47]`) pero el GET las devuelve
 * enriquecidas (`[{id: 46, name: "WiFi"}]`) — round-trip asimétrico (reporte de
 * backend, 2026-09-06: re-enviar lo leído mandaba los objetos). Esta frontera
 * acepta las tres formas que circulan y siempre emite ids numéricos.
 */
export function toAmenityIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) return []
    const ids: number[] = []
    for (const item of raw) {
        const candidate =
            typeof item === "object" && item !== null
                ? Number((item as { id?: unknown }).id)
                : Number(item)
        if (Number.isInteger(candidate) && candidate > 0 && !ids.includes(candidate)) {
            ids.push(candidate)
        }
    }
    return ids
}

const optionalText = (value: string | null | undefined): string | undefined => {
    const normalized = String(value ?? "").trim()
    return normalized || undefined
}

/**
 * Converts the UI draft into the canonical camelCase `/listings` payload.
 * Compatibility aliases stay inside `listingsService`; components should not
 * each reimplement inheritance, trimming and price placement.
 */
export function toListingPayload(propertyUuid: string, draft: ListingDraft): ListingApiPayload {
    const {
        inheritWifi = true,
        inheritSchedule = true,
        inheritPolicies = true,
        inheritAmenities = true,
        amenities,
        wifiDetails,
        checkIn,
        checkOut,
        cancellationPolicy,
        ...persistedExtra
    } = draft.extra ?? {}

    if (!inheritWifi) persistedExtra.wifiDetails = wifiDetails
    if (!inheritSchedule) {
        persistedExtra.checkIn = checkIn
        persistedExtra.checkOut = checkOut
    }
    if (!inheritPolicies) persistedExtra.cancellationPolicy = cancellationPolicy
    // Siempre ids al escribir, venga lo que venga del GET o del formulario.
    if (!inheritAmenities) persistedExtra.amenities = toAmenityIds(amenities)

    const price = Number(draft.price ?? 0)
    persistedExtra.startPrice = Number.isFinite(price) ? price : 0

    return {
        propertyUuid,
        name: String(draft.name ?? "").trim(),
        internalName: optionalText(draft.internalName),
        roomTypeId: Number(draft.roomTypeId),
        description: optionalText(draft.description),
        thumbnailUrl: optionalText(draft.thumbnailUrl),
        contactName: optionalText(draft.contactName),
        contactEmail: optionalText(draft.contactEmail),
        contactPhone: optionalText(draft.contactPhone),
        statusRecordId: draft.isActive === false ? 7 : 6,
        extra: persistedExtra,
        // Contrato 2026-08-23: `[]` borra todas las filas; la clave omitida no
        // toca nada. El caller decide si la sección se editó (dirty-gating) y lo
        // expresa dejando `externalPmsIds` en `undefined` para omitirla.
        ...(draft.externalPmsIds !== undefined
            ? { externalPmsIds: toExternalPmsIdsPayload(draft.externalPmsIds) }
            : {}),
    }
}
