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
    timezone?: string | null
    statusRecordId: number
    // top level fields (potential server column support)
    price?: number | string | null
    start_price?: number | string | null
    startPrice?: number | string | null
    
    extra?: {
        picturesUrl?: string[]
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
        thumbnailUrl?: string
        thumbnail_url?: string      // Production API snake_case
        automationSettings?: any
        policies?: any[]
        roomTypes?: any[]
        units?: any[]
    } | null
    externalPmsIds?: {
        sourcePmsId: number
        externalId: string
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
    type?: string
    internalName?: string
    internal_name?: string | null
    thumbnailUrl?: string
    thumbnail_url?: string | null
    startPrice?: number
    start_price?: number | null
    currency?: string
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
        type?: string
        internal_name?: string | null // Capture "Nombre Interno" from production API
        startPrice?: number
        start_price?: number        // snake_case alternative from some endpoints
        currency?: string
        thumbnailUrl?: string
        thumbnail_url?: string      // snake_case alternative from some endpoints
        automationSettings?: any
        policies?: any[]
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
    type: z.string().min(1, "El tipo de propiedad es obligatorio").max(60),
    startPrice: z.coerce.number().min(1, "El precio inicial debe ser un número mayor a 0"),
    currency: z.string().min(1, "La moneda es obligatoria").max(10),
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
        
        // Final attempt Price persistence: Top level (potential columns)
        price: Number(data.startPrice) || 0,
        start_price: Number(data.startPrice) || 0,
        startPrice: Number(data.startPrice) || 0,
        
        extra: {
            type: data.type,
            // Ensure numeric for production validation rules inside extra
            start_price: Number(data.startPrice) || 0,
            startPrice: Number(data.startPrice) || 0,
            internal_name: data.external_id || null, 
            currency: data.currency,
            thumbnailUrl: data.thumbnailUrl,
            thumbnail_url: data.thumbnailUrl,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            cancellationPolicy: data.cancellationPolicy,
            amenities: (data.amenities || []).map(a => {
                // API expects numbers, but UI works with strings
                if (typeof a === 'object' && a?.id) return Number(a.id);
                const parsed = parseInt(String(a));
                return isNaN(parsed) ? a : parsed;
            }),
            wifiDetails: {
                network: data.wifiNetwork,
                password: data.wifiPassword,
            },
            picturesUrl: data.picturesUrl,
            automationSettings: data.automationSettings,
            policies: data.policies,
            roomTypes: data.roomTypes,
            // Units stored in extra since there is no separate listings endpoint
            units: (data.units || []).map((u: any) => {
                // Strip react-hook-form internal id and UI-only fields before persisting
                const { id: _rhfId, customFields: _cf, ...rest } = u
                return {
                    ...rest,
                    price: Number(u.price) || 0,
                }
            }),
        },
        // units are NOT sent here — they are saved inside extra.units above
        ...(data.externalPmsIds && data.externalPmsIds.length > 0 ? {
            externalPmsIds: data.externalPmsIds.map((id: any) => ({
                sourcePmsId: id.sourcePmsId,
                externalId: id.externalId
            }))
        } : {})
    }
    
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

    // Capture external_id (Internal Name) from extra.internal_name or identifiers
    let external_id = extra.internal_name || apiData.externalId || apiData.external_id || ""
    
    // If not in extra, try to find it in identifiers
    if (!external_id && apiData.pmsIdentifiers && apiData.pmsIdentifiers.length > 0) {
        external_id = apiData.pmsIdentifiers[0].externalId
    }

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
        type: extra.type || "HOTEL",
        // Check both camelCase and snake_case for price and thumbnail
        startPrice: Number(apiData.price || apiData.start_price || apiData.startPrice || extra.start_price || extra.startPrice || 0),
        currency: extra.currency || "COP",
        thumbnailUrl: extra.thumbnail_url || extra.thumbnailUrl || "",
        checkIn: extra.checkIn || "",
        checkOut: extra.checkOut || "",
        cancellationPolicy: extra.cancellationPolicy || "",
        amenities: (extra.amenities || []).map((a: any) => {
            // UI expect strings for checkboxes checks against catalogs
            if (typeof a === 'object' && a?.id) return String(a.id)
            return String(a)
        }),
        wifiNetwork: wifi.network || "",
        wifiPassword: wifi.password || "",
        picturesUrl: (extra as any).picturesUrl || (extra as any).pictures_url || [],
        units: (
            // Priority: extra.units (our persisted format) → top-level units/listings (legacy API response)
            (extra as any).units ||
            apiData.units ||
            apiData.listings ||
            []
        ).map((u: any) => ({
            ...u,
            id: u.id || Math.random(),
            uuid: u.uuid,
            name: u.name || "",
            internal_name: u.internal_name || "",
            room_type_id: u.room_type_id || 1,
            price: u.price || u.total_price || u.start_price || u.extra?.startPrice || u.extra?.total_price || "",
            customFields: u.customFields || [],
            extra: u.extra || {
                max_occupancy: 2,
                min_nights: 1,
                max_nights: 30,
                check_in: "15:00",
                check_out: "11:00",
                bed_room: { type: "KING", count: 1, bedsCount: 1 },
                bath_room: { type: "PRIVATE", count: 1 },
                amenities: [],
                pictures_url: [],
            }
        })),
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
