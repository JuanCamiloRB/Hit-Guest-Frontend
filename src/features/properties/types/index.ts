import { z } from "zod"
import { normalizeLocale, DEFAULT_COMMUNICATION_LOCALE, type CommunicationLocale } from "@/lib/locales"

export type {
    PropertyAutomation,
    PropertyAutomationPayload,
    PropertyAutomationCreatePayload,
    PropertyAutomationUpdatePayload,
    PropertyAutomationConfigurePayload,
    AutomationDefinition,
    ProviderOption,
    ParameterFieldSchema,
    AutomationCardState,
    TTLockParameters,
    TTLockLock,
    PdfReportParameters,
    TraColombiaParameters,
    SireColombiaParameters,
    Provider,
    AutomationUsageRecord,
    AutomationStatus,
    GuestType,
    UsageRecordStatus,
    LockType,
} from "./automation"

export { AUTOMATION_ORDERS, AUTOMATION_STATUS, GUEST_TYPE_LABELS, mapGuestTypeToApi } from "./automation"

import type { PropertyAutomation } from "./automation"

// ── API Payload Types (what the backend expects in camelCase) ──

export interface PropertyApiPayload {
    name: string
    description?: string | null
    email: string
    phone?: string | null
    address: string
    addressDetail?: string | null
    city: string
    state: string
    countryId: number
    latitude?: string | null
    longitude?: string | null
    timezone?: string | null
    statusRecordId: number
    propertyTypeId: number
    extra?: {
        picturesUrl?: string[]
        checkIn?: string | null
        checkOut?: string | null
        cancellationPolicy?: string | null
        amenities?: number[]          // IDs as integers in the request payload
        wifiDetails?: {
            network?: string | null
            password?: string | null
        } | null
        internal_name?: string | null
        currency?: string
        /** Language for guest communications: "es" | "en" | "pt". */
        communicationsLocale?: string
        thumbnailUrl?: string
        policies?: any[]
        roomTypes?: any[]
    } | null
    externalPmsIds?: {
        sourcePmsId: number
        externalId: string
    }[]
    // NOTE: units are NOT included here — managed separately via listingsService
}

export interface PropertyExtra {
    picturesUrl?: string[]
    checkIn?: string | null
    checkOut?: string | null
    cancellationPolicy?: string | null
    amenities?: number[]
    wifiDetails?: WifiDetails | null
    // UI-specific extras (flexible)
    type?: string                 // Backward compatibility
    propertyTypeId?: number | string | null
    internalName?: string
    internal_name?: string | null
    thumbnailUrl?: string
    thumbnail_url?: string | null
    startPrice?: number
    start_price?: number | null
    currency?: string
    price?: number | string | null
    roomTypes?: any[]
    automationSettings?: AutomationSettings
}

export interface WifiDetails {
    network?: string | null
    password?: string | null
}

export interface ExternalPmsId {
    sourcePmsId: number
    externalId: string
}

export interface AutomationSettings {
    welcome_message: boolean
    checkin_instructions: boolean
    digital_key: boolean
    online_checkin: boolean
    cleaning_task: boolean
}

// ── API Response Types (Kunas API returns flat snake_case structures) ──

export interface PropertyApiResponse {
    // ── Identifiers ──────────────────────────────────────────────────────────
    uuid: string
    clientUuid?: string
    userUuid?: string
    user_id?: number
    /** @deprecated integer id — backend is UUID-only. Kept for backward compat. */
    id?: number

    // ── Top-level fields ─────────────────────────────────────────────────────
    name: string
    description?: string | null
    propertyType?: { id: number; name: string }         // New nested shape
    propertyTypeId?: number                             // Fallback flat field
    property_type_id?: number                          // Fallback snake_case
    statusRecord?: { id: number; name: string }
    statusRecordId?: number
    status_record_id?: number
    automations?: PropertyAutomation[]                  // Sideloaded
    createdAt?: string
    updatedAt?: string
    deletedAt?: string | null

    // ── Nested contact / location (canonical API shape) ───────────────────────
    contact?: {
        email?: string
        phone?: string | null
    }
    location?: {
        address?: string
        addressDetail?: string
        city?: string
        state?: string
        latitude?: string | null
        longitude?: string | null
        timezone?: string | null
        country?: { id: number; name: string }
        countryId?: number
    }

    // ── Flat location fallbacks (legacy / alternate endpoints) ────────────────
    email?: string
    phone?: string | null
    address?: string
    address_detail?: string | null
    city?: string
    state?: string
    countryId?: number
    country_id?: number
    geo_location?: string | null
    latitude?: string | null
    longitude?: string | null
    timezone?: string | null

    // ── Extra (property-level config) ─────────────────────────────────────────
    extra?: {
        picturesUrl?: string[]
        pictures_url?: string[]
        checkIn?: string | null
        checkOut?: string | null
        cancellationPolicy?: string | null
        /** Response shape: objects {id, name}. Send IDs (number[]) on create/update. */
        amenities?: Array<{ id: number; name: string }> | number[]
        wifiDetails?: { network?: string | null; password?: string | null } | null
        internal_name?: string | null
        currency?: string
        thumbnailUrl?: string
        thumbnail_url?: string
        propertyTypeId?: number | string | null
        automationSettings?: any
        policies?: any[]
        roomTypes?: any[]
        startPrice?: number
        start_price?: number
        price?: number | string | null
    }

    // ── PMS identifiers ────────────────────────────────────────────────────────
    pmsIdentifiers?: {
        id?: number
        sourcePmsId: number
        sourcePms?: string | null     // Provider name from catalog
        externalId: string
    }[]

    // ── Legacy flat fields (some endpoints still return these) ─────────────────
    externalId?: string
    external_id?: string
    amenity_ids?: (string | number)[]
    amenities?: (string | number)[]
    price?: number | string | null
    startPrice?: number | string | null
    start_price?: number | string | null

    // ── Listings (sideloaded) ──────────────────────────────────────────────────
    units?: any[]
    listings?: any[]
}

// ── Zod Schema for form validation ──

export const propertyFormSchema = z.object({
    uuid: z.string().uuid().optional(),  // Set by form on edit mode; used by sub-components to fetch per-property data
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(120, "Máximo 120 caracteres"),
    description: z.string().optional(),
    email: z.string().email("Email inválido").max(60, "Máximo 60 caracteres"),
    phone: z.string().max(60, "Máximo 60 caracteres").optional(),
    address: z.string().min(3, "La dirección es obligatoria").max(255, "Máximo 255 caracteres"),
    addressDetail: z.string().max(255, "Máximo 255 caracteres").optional(),
    city: z.string().min(2, "La ciudad es obligatoria").max(120, "Máximo 120 caracteres"),
    state: z.string().min(2, "El estado/departamento es obligatorio").max(120, "Máximo 120 caracteres"),
    countryId: z.number().int().positive(),
    latitude: z.coerce.number().min(-90).max(90).default(0),
    longitude: z.coerce.number().min(-180).max(180).default(0),
    external_id: z.string().max(60).optional(),
    timezone: z.string().max(120, "Máximo 120 caracteres").optional(),
    statusRecordId: z.number().int().positive(),
    propertyTypeId: z.coerce.number().min(1, "El tipo de propiedad es obligatorio"),
    thumbnailUrl: z.string().optional(),
    /** Language used for guest communications (check-in link email, etc.). Stored in extra. */
    communicationsLocale: z.enum(["es", "en", "pt"]).optional(),

    // Extra fields
    checkIn: z.string().max(10).optional(),
    checkOut: z.string().max(10).optional(),
    cancellationPolicy: z.string().optional(),
    amenities: z.array(z.any()).optional(), // Accept any type (numbers, strings, or objects)
    wifiNetwork: z.string().max(100).optional(),
    wifiPassword: z.string().max(100).optional(),
    picturesUrl: z.array(z.string().max(500)).optional(),

    // Units (Alojamiento)
    units: z.array(z.any()).optional(),

    // Policies
    policies: z.array(z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.string().optional(),
    })).optional(),

    // Room Types
    roomTypes: z.array(z.any()).optional(),

    // Automation
    automationSettings: z.object({
        welcome_message: z.boolean().optional(),
        checkin_instructions: z.boolean().optional(),
        digital_key: z.boolean().optional(),
        online_checkin: z.boolean().optional(),
        cleaning_task: z.boolean().optional(),
    }).optional(),

    // External PMS IDs
    externalPmsIds: z.array(z.object({
        sourcePmsId: z.number().int().positive(),
        externalId: z.string().max(60),
    })).optional(),
})

export type PropertyFormData = z.infer<typeof propertyFormSchema>

// ── Helper: Convert form data to API payload ──

export function formDataToApiPayload(data: PropertyFormData): PropertyApiPayload {
        let finalPicturesUrl = [...(data.picturesUrl || [])];
        
        // If there's a thumbnail URL, make sure it's the FIRST element of picturesUrl.
        // We replace the first element if the array is not empty to avoid stacking old thumbnails.
        if (data.thumbnailUrl) {
            if (finalPicturesUrl.length > 0) {
                 finalPicturesUrl[0] = data.thumbnailUrl;
            } else {
                 finalPicturesUrl.push(data.thumbnailUrl);
            }
        }
        
        // Ensure no duplicates
        finalPicturesUrl = Array.from(new Set(finalPicturesUrl));

        const amenityIds: number[] = (data.amenities || [])
            .map(a => parseInt(String(a)))
            .filter(n => !isNaN(n))

        const payload: PropertyApiPayload = {
            name: data.name,
            description: data.description || null,
            email: data.email,
            phone: data.phone || null,
            address: data.address,
            addressDetail: data.addressDetail || null,
            city: data.city,
            state: data.state,
            countryId: data.countryId,
            latitude: (data.latitude !== undefined && data.latitude !== null) ? String(data.latitude) : "0.00000000",
            longitude: (data.longitude !== undefined && data.longitude !== null) ? String(data.longitude) : "0.00000000",
            timezone: data.timezone || "America/Bogota",
            statusRecordId: data.statusRecordId,
            propertyTypeId: Number(data.propertyTypeId),

            extra: {
                internal_name: data.external_id || null,
                currency: "COP",
                communicationsLocale: data.communicationsLocale || DEFAULT_COMMUNICATION_LOCALE,
                thumbnailUrl: data.thumbnailUrl,
                checkIn: data.checkIn,
                checkOut: data.checkOut,
                cancellationPolicy: data.cancellationPolicy,
                amenities: amenityIds,
                wifiDetails: {
                    network: data.wifiNetwork,
                    password: data.wifiPassword,
                },
                picturesUrl: finalPicturesUrl,
                policies: data.policies,
                roomTypes: data.roomTypes,
            },
            ...(data.externalPmsIds && data.externalPmsIds.length > 0 ? {
                externalPmsIds: data.externalPmsIds.map((id: any) => ({
                    sourcePmsId: id.sourcePmsId,
                    externalId: id.externalId,
                }))
            } : {})
        }
    
    console.log("📤 [formDataToApiPayload] Final Payload to API:", JSON.stringify(payload, null, 2));
    return payload
}

// ── Helper: Convert API response to form data ──

export function apiResponseToFormData(apiData: PropertyApiResponse): PropertyFormData {
    if (!apiData) return {} as any
    
    
    const extra = apiData.extra || {}
    const wifi = extra.wifiDetails || {}
    const location = apiData.location || {}
    const contact = apiData.contact || {}
    
    // Resilient value extraction helper: checks top level then nested
    const getVal = (top: any, sub: any, fallback: any = "") => {
        if (top !== undefined && top !== null && top !== "") return top
        if (sub !== undefined && sub !== null && sub !== "") return sub
        return fallback
    }

    // Parse geo_location "lat,lng" if available
    let lat = 0
    let lng = 0
    if (apiData.geo_location) {
        const parts = apiData.geo_location.split(',')
        if (parts.length === 2) {
            lat = parseFloat(parts[0]) || 0
            lng = parseFloat(parts[1]) || 0
        }
    } else {
        const rawLat = getVal(apiData.latitude, location.latitude, "0")
        const rawLng = getVal(apiData.longitude, location.longitude, "0")
        lat = parseFloat(rawLat) || 0
        lng = parseFloat(rawLng) || 0
    }

    // Capture external_id (Nombre Interno) from multiple possible locations
    let external_id = apiData.externalId 
        || apiData.external_id 
        || (apiData as any).external_id
        || extra.internal_name 
        || ""
    
    // If not found, try pmsIdentifiers
    if (!external_id && apiData.pmsIdentifiers && apiData.pmsIdentifiers.length > 0) {
        external_id = apiData.pmsIdentifiers[0].externalId
    }

    const extractedThumbnail = extra.thumbnail_url || extra.thumbnailUrl || ((extra as any).picturesUrl && (extra as any).picturesUrl.length > 0 ? (extra as any).picturesUrl[0] : "") || ((extra as any).pictures_url && (extra as any).pictures_url.length > 0 ? (extra as any).pictures_url[0] : "") || "";
    console.log("🔥 [apiResponseToFormData] Extracted Thumbnail:", extractedThumbnail, "from extra:", extra);

    return {
        name: apiData.name || "",
        description: apiData.description || "",
        email: getVal(apiData.email, contact.email, ""),
        phone: getVal(apiData.phone, contact.phone, ""),
        address: getVal(apiData.address, location.address, ""),
        addressDetail: getVal(apiData.address_detail, location.addressDetail, ""),
        city: getVal(apiData.city, location.city, ""),
        state: getVal(apiData.state, location.state, ""),
        countryId: apiData.countryId || apiData.country_id || location.countryId || location.country?.id || 48,
        latitude: lat,
        longitude: lng,
        timezone: apiData.timezone || location.timezone || "America/Bogota",
        external_id: external_id,
        statusRecordId: apiData.statusRecordId || apiData.status_record_id || apiData.statusRecord?.id || 6,
        propertyTypeId: Number(apiData.propertyType?.id || apiData.propertyTypeId || apiData.property_type_id || (extra as any).propertyTypeId || (extra as any).type || 102),
        thumbnailUrl: extractedThumbnail,
        communicationsLocale: (normalizeLocale((extra as any).communicationsLocale || (extra as any).communications_locale) || DEFAULT_COMMUNICATION_LOCALE) as CommunicationLocale,
        checkIn: extra.checkIn || "",
        checkOut: extra.checkOut || "",
        cancellationPolicy: extra.cancellationPolicy || "",
        amenities: (() => {
            // Priority: extra.amenities → apiData.amenities → apiData.amenity_ids
            const raw = (extra.amenities || apiData.amenities || apiData.amenity_ids || [])
            return (raw as any[]).map((a: any) => {
                if (typeof a === 'object' && a?.id) return String(a.id)
                return String(a)
            })
        })(),
        wifiNetwork: wifi.network || "",
        wifiPassword: wifi.password || "",
        picturesUrl: (extra as any).picturesUrl || (extra as any).pictures_url || [],
        // Deduplicate units from all possible sources (API often returns them in multiple places)
        units: (() => {
            const propertyUuid = apiData.uuid || ""
            const rawUnits = [
                ...(apiData.units || []),
                ...(apiData.listings || []),
                ...((extra as any).units || [])
            ]
            
            // Filter: only keep units that belong to THIS property
            const filteredUnits = propertyUuid 
                ? rawUnits.filter((u: any) => {
                    const unitPropUuid = u.propertyUuid || u.property_uuid || u.propertyId || ""
                    // Keep unit if it belongs to this property, or if it has no propertyUuid (assume it's ours)
                    return !unitPropUuid || unitPropUuid === propertyUuid
                })
                : rawUnits
            
            const uniqueMap = new Map()
            filteredUnits.forEach((u: any) => {
                const key = u.uuid || `${u.name}-${u.internalName || u.internal_name}`
                const uExtra = u.extra || {}
                const hasPrice = Number(uExtra.startPrice || uExtra.start_price || u.startPrice || u.start_price || u.price || 0) > 0
                
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, u)
                } else if (hasPrice) {
                    // PRIORITIZE: If this version has a price and the existing one didn't, overwrite it
                    const existing = uniqueMap.get(key)
                    const exExtra = existing.extra || {}
                    const existingPrice = Number(exExtra.startPrice || exExtra.start_price || existing.startPrice || existing.start_price || existing.price || 0)
                    
                    if (existingPrice === 0) {
                        uniqueMap.set(key, u)
                    }
                }
            })

            return Array.from(uniqueMap.values())
        })().map((u: any) => {
            const extraData = u.extra || {}
            // Determine if fields were inherited
            const hasWifi = !!extraData.wifiDetails
            const hasSchedule = !!extraData.checkIn || !!extraData.checkOut
            const hasPolicies = !!extraData.cancellationPolicy

            return {
                ...u,
                id: u.uuid || u.id || Math.random(),
                name: u.name || "",
                internalName: u.internalName || u.internal_name || "",
                description: u.description || "",
                thumbnailUrl: u.thumbnailUrl || u.thumbnail_url || "",
                // roomType can come as nested { id, name } or flat roomTypeId / room_type_id
                roomTypeId: String(u.roomType?.id || u.roomTypeId || u.room_type_id || "1"),
                // contact can come as nested { name, email, phone } or flat camelCase/snake_case
                contactName:  u.contact?.name  || u.contactName  || u.contact_name  || "",
                contactEmail: u.contact?.email || u.contactEmail || u.contact_email || "",
                contactPhone: u.contact?.phone || u.contactPhone || u.contact_phone || "",
                // Robust price mapping: Include u.startPrice (camelCase at top-level) which the API is returning
                price: extraData.startPrice || extraData.start_price || extraData.price || u.startPrice || u.start_price || u.total_price || u.price || "",
                // statusRecord can come as nested { id } or flat statusRecordId / status_record_id
                isActive: u.isActive ?? (u.statusRecord?.id === 6 || u.statusRecordId === 6 || u.status_record_id === 6 || u.status === "ACT") ?? true,
                statusRecordId: u.statusRecord?.id || u.statusRecordId || u.status_record_id || 6,
                customFields: u.customFields || [],
                extra: {
                    maxOccupancy: extraData.maxOccupancy || extraData.max_occupancy || 2,
                    minNights: extraData.minNights || extraData.min_nights || 1,
                    maxNights: extraData.maxNights || extraData.max_nights || 30,
                    checkIn: extraData.checkIn || extraData.check_in || "15:00",
                    checkOut: extraData.checkOut || extraData.check_out || "11:00",
                    bedRoom: extraData.bedRoom || extraData.bed_room?.bedsCount || 1,
                    bathRoom: extraData.bathRoom || extraData.bath_room?.count || 1,
                    rooms: extraData.rooms || 1,
                    amenities: extraData.amenities || [],
                    picturesUrl: extraData.picturesUrl || extraData.pictures_url || [],
                    wifiDetails: extraData.wifiDetails || extraData.wifi_details || { network: "", password: "" },
                    cancellationPolicy: extraData.cancellationPolicy || extraData.cancellation_policy || "STANDARD",
                    inheritWifi: !hasWifi,
                    inheritSchedule: !hasSchedule,
                    inheritPolicies: !hasPolicies,
                }
            }
        }),
        policies: extra.policies || [],
        roomTypes: (extra as any).roomTypes || (extra as any).room_types || [],
        automationSettings: extra.automationSettings || {
            welcome_message: true,
            checkin_instructions: true,
            digital_key: false,
            online_checkin: true,
            cleaning_task: true,
        },
        externalPmsIds: apiData.pmsIdentifiers?.map((id) => ({
            sourcePmsId: id.sourcePmsId,
            externalId: id.externalId,
        })) || []
    }
}
