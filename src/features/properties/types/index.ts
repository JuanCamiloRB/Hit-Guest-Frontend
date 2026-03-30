import { z } from "zod"

// ── API Payload Types (what the backend expects in camelCase) ──

export interface PropertyApiPayload {
    userUuid: string
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
        currency?: string
        thumbnailUrl?: string
        automationSettings?: any
        policies?: any[]
        roomTypes?: any[]
    } | null
    units?: any[]
    externalPmsIds?: {
        sourcePmsId: number
        externalId: string
    }[]
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
    thumbnailUrl?: string
    startPrice?: number
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

// ── API Response Types (what the backend returns in snake_case) ──

export interface PropertyApiResponse {
    id: number
    uuid: string
    user_id: number | string
    name: string
    description?: string | null
    email: string
    phone?: string | null
    address: string
    address_detail?: string | null
    city: string
    state: string
    country_id: number
    latitude?: string | null
    longitude?: string | null
    external_id?: string | null
    timezone?: string | null
    extra?: any
    status_record_id: number
    units?: any[]
    external_identifiers?: {
        id?: number
        source_pms_id: number
        external_id: string
    }[]
    external_pms_ids?: {
        id?: number
        source_pms_id: number
        external_id: string
    }[]
    geo_location?: string | null
    created_at?: string | null
    updated_at?: string | null
    deleted_at?: string | null
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
    latitude: z.number().min(-90).max(90).default(0),
    longitude: z.number().min(-180).max(180).default(0),
    external_id: z.string().max(60).optional(),
    timezone: z.string().max(120, "Máximo 120 caracteres").optional(),
    statusRecordId: z.number().int().positive(),
    type: z.string().max(60).optional(),
    startPrice: z.number().min(0).optional(),
    currency: z.string().max(10).optional(),
    thumbnailUrl: z.string().optional(),

    // Extra fields
    checkIn: z.string().max(10).optional(),
    checkOut: z.string().max(10).optional(),
    cancellationPolicy: z.string().optional(),
    amenities: z.array(z.union([z.number(), z.string()])).optional(),
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

export function formDataToApiPayload(data: PropertyFormData, userUuid: string): PropertyApiPayload {
    return {
        userUuid: userUuid,
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
        externalId: data.external_id || null,
        statusRecordId: data.statusRecordId,
        extra: {
            type: data.type,
            startPrice: data.startPrice,
            currency: data.currency,
            thumbnailUrl: data.thumbnailUrl,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            cancellationPolicy: data.cancellationPolicy,
            amenities: data.amenities?.map(a => {
                if (typeof a === 'string') {
                    const parsed = parseInt(a);
                    return isNaN(parsed) ? a : parsed;
                }
                return a;
            }),
            wifiDetails: {
                network: data.wifiNetwork,
                password: data.wifiPassword,
            },
            picturesUrl: data.picturesUrl,
            automationSettings: data.automationSettings,
            policies: data.policies,
            roomTypes: data.roomTypes,
        },
        units: data.units || [],
        externalPmsIds: data.externalPmsIds?.map((id: any) => ({
            sourcePmsId: id.sourcePmsId,
            externalId: id.externalId
        }))
    }
}

// ── Helper: Convert API response to form data ──

export function apiResponseToFormData(apiData: PropertyApiResponse): PropertyFormData {
    const extra = apiData.extra || {}
    const wifi = extra.wifi_details || {}

    return {
        name: apiData.name || "",
        description: apiData.description || "",
        email: apiData.email || "",
        phone: apiData.phone || "",
        address: apiData.address || "",
        addressDetail: apiData.address_detail || "",
        city: apiData.city || "",
        state: apiData.state || "",
        countryId: apiData.country_id || 48,
        latitude: apiData.latitude ? parseFloat(apiData.latitude) : 0,
        longitude: apiData.longitude ? parseFloat(apiData.longitude) : 0,
        timezone: apiData.timezone || "",
        external_id: apiData.external_id || "",
        statusRecordId: apiData.status_record_id || 6,
        type: extra.type || "",
        startPrice: extra.start_price || extra.startPrice || 0,
        currency: extra.currency || "COP",
        thumbnailUrl: extra.thumbnail_url || extra.thumbnailUrl || "",
        checkIn: extra.check_in || extra.checkIn || "",
        checkOut: extra.check_out || extra.checkOut || "",
        cancellationPolicy: extra.cancellation_policy || extra.cancellationPolicy || "",
        amenities: extra.amenities || [],
        wifiNetwork: wifi.network || wifi.networkName || "",
        wifiPassword: wifi.password || "",
        picturesUrl: extra.pictures_url || extra.picturesUrl || [],
        units: apiData.units || [],
        policies: extra.policies || [],
        roomTypes: extra.room_types || extra.roomTypes || [],
        automationSettings: extra.automation_settings || extra.automationSettings || {
            welcome_message: false,
            checkin_instructions: false,
            digital_key: false,
            online_checkin: false,
            cleaning_task: false,
        },
        externalPmsIds: (apiData.external_pms_ids || apiData.external_identifiers)?.map((id: any) => ({
            sourcePmsId: id.source_pms_id,
            externalId: id.external_id,
        })) || []
    }
}
