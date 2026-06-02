import { z } from "zod"

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
    externalId?: string | null
    external_id?: string | null
    timezone?: string | null
    statusRecordId: number
    propertyTypeId: number
    thumbnailUrl?: string | null
    thumbnail_url?: string | null
    // top level fields (potential server column support)
    price?: number | string | null
    start_price?: number | string | null
    startPrice?: number | string | null
    amenity_ids?: (string | number)[]
    amenities?: (string | number)[]
    
    extra?: {
        picturesUrl?: string[]
        pictures_url?: string[]
        checkIn?: string | null
        checkOut?: string | null
        cancellationPolicy?: string | null
        amenities?: (number | string)[]
        wifiDetails?: {
            network?: string | null
            password?: string | null
        } | null
        type?: string
        startPrice?: number
        start_price?: number        // Production API snake_case
        internal_name?: string | null // Production API actual field for "Nombre Interno"
        currency?: string
        propertyTypeId?: number | string | null // Support for catalogs
        thumbnailUrl?: string
        thumbnail_url?: string      // Production API snake_case
        automationSettings?: any
        policies?: any[]
        roomTypes?: any[]
        price?: number | string | null
        units?: any[]
    } | null
    externalPmsIds?: {
        sourcePmsId: number
        externalId: string
    }[]
    external_identifiers?: {
        source_pms_id: number
        external_id: string
    }[]
    // NOTE: units are NOT included here — they are managed separately via listingsService
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
    id: number
    uuid: string
    user_id?: number
    userUuid?: string
    name: string
    description?: string | null
    email?: string                   
    phone?: string | null           
    address?: string                 
    address_detail?: string | null  
    city?: string                    
    state?: string                   
    country_id?: number              
    countryId?: number
    geo_location?: string | null    
    latitude?: string | null        
    longitude?: string | null       
    timezone?: string | null
    status_record_id?: number        
    statusRecordId?: number
    propertyTypeId?: number
    property_type_id?: number
    statusRecord?: {                
        id: number
        name: string
    }
    // Handle possible nested structures
    location?: {
        address?: string
        addressDetail?: string
        city?: string
        state?: string
        countryId?: number
        latitude?: string | null
        longitude?: string | null
        timezone?: string | null
    }
    contact?: {
        email?: string
        phone?: string | null
    }
    extra?: {
        picturesUrl?: string[]
        checkIn?: string | null
        checkOut?: string | null
        cancellationPolicy?: string | null
        amenities?: number[]
        wifiDetails?: {
            network?: string | null
            password?: string | null
        } | null
        type?: string                 // Backward compatibility
        propertyTypeId?: number | string | null
        internal_name?: string | null // Capture "Nombre Interno" from production API
        startPrice?: number
        start_price?: number        // snake_case alternative from some endpoints
        currency?: string
        thumbnailUrl?: string
        thumbnail_url?: string      // snake_case alternative from some endpoints
        automationSettings?: any
        policies?: any[]
        price?: number | string | null
        roomTypes?: any[]
    }
    // integration / external IDs
    externalId?: string             // Optional at top level
    external_id?: string            // Optional at top level (snake_case)
    pmsIdentifiers?: {
        id?: number
        sourcePmsId: number
        externalId: string
    }[]
    
    // top level fields (potential server column support)
    price?: number | string | null
    start_price?: number | string | null
    startPrice?: number | string | null
    amenity_ids?: (string | number)[]
    amenities?: (string | number)[]
    
    createdAt?: string
    updatedAt?: string
    deletedAt?: string | null
    units?: any[]                   // Nested units (listings)
    listings?: any[]                // Nested listings (alias)
}

// ── Zod Schema for form validation ──

export const propertyFormSchema = z.object({
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
            
            // External ID (Nombre Interno)
            externalId: data.external_id || null,
            external_id: data.external_id || null,
            
            // Thumbnail
            thumbnailUrl: data.thumbnailUrl || null,
            thumbnail_url: data.thumbnailUrl || null,
            
            amenities: (data.amenities || []).map(a => {
                const str = String(a)
                const parsed = parseInt(str)
                return /^\d+$/.test(str) ? parsed : str
            }),
            amenity_ids: (data.amenities || []).map(a => {
                const str = String(a)
                const parsed = parseInt(str)
                return /^\d+$/.test(str) ? parsed : str
            }),

            extra: {
                internal_name: data.external_id || null, 
                currency: "COP",
                thumbnailUrl: data.thumbnailUrl,
                thumbnail_url: data.thumbnailUrl,
                checkIn: data.checkIn,
                checkOut: data.checkOut,
                cancellationPolicy: data.cancellationPolicy,
                amenities: (data.amenities || []).map(a => {
                    const str = String(a);
                    const parsed = parseInt(str);
                    if (/^\d+$/.test(str)) return parsed;
                    return str;
                }),
                wifiDetails: {
                    network: data.wifiNetwork,
                    password: data.wifiPassword,
                },
                // Send the updated picturesUrl which contains the new thumbnail
                picturesUrl: finalPicturesUrl,
                pictures_url: finalPicturesUrl,
                automationSettings: data.automationSettings,
                policies: data.policies,
                roomTypes: data.roomTypes,
            },
        ...(data.externalPmsIds && data.externalPmsIds.length > 0 ? {
            external_identifiers: data.externalPmsIds.map((id: any) => ({
                source_pms_id: id.sourcePmsId,
                external_id: id.externalId
            })),
            externalPmsIds: data.externalPmsIds.map((id: any) => ({
                sourcePmsId: id.sourcePmsId,
                externalId: id.externalId
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
        countryId: apiData.countryId || apiData.country_id || location.countryId || (location as any).country?.id || 48,
        latitude: lat,
        longitude: lng,
        timezone: apiData.timezone || location.timezone || "America/Bogota",
        external_id: external_id,
        statusRecordId: apiData.statusRecordId || apiData.status_record_id || apiData.statusRecord?.id || 6,
        propertyTypeId: Number(apiData.propertyTypeId || apiData.property_type_id || extra.propertyTypeId || extra.type || 102),
        thumbnailUrl: extractedThumbnail,
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
