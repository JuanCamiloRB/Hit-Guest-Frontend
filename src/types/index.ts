export type Role = "ADMIN" | "STAFF" | "GUEST"

export interface AutomationStatus {
    link: "success" | "pending" | "none"
    checkin: "success" | "pending" | "none"
    contract: "success" | "pending" | "none"
    code: "success" | "pending" | "none"
    tra: "success" | "pending" | "none"
    sire: "success" | "pending" | "none"
}


export interface User {
    id: string
    name: string
    email: string
    phone?: string
    role: Role
    status: "ACTIVE" | "INACTIVE"
    avatarUrl?: string
}

export type PropertyType = 'HOTEL' | 'APARTAHOTEL' | 'BUILDING' | 'HOUSE' | 'RESORT' | 'HOSTEL'

export interface Property {
    id: number
    uuid?: string
    user_id: number
    external_id?: string
    name: string
    description?: string
    email: string
    phone?: string
    address: string
    address_detail?: string
    city: string
    state: string
    country_id: number
    geo_location?: string // latitude,longitude
    timezone?: string
    extra: any // JSON object for flexible data (type, status, thumbnailUrl, startPrice, currency, etc.)
    status_record_id: number
    created_at?: string
    updated_at?: string
    deleted_at?: string
}

export interface Listing {
    id: number
    uuid?: string
    user_id: number
    property_id: number
    name: string
    internal_name?: string
    room_type_id: number
    description?: string
    thumbnail_url: string
    contact_name: string
    contact_email?: string
    contact_phone?: string
    extra: any // JSON object (pictures_url, bed_room, bath_room, rooms, max_occupancy, min_nights, max_nights, channels, check_in, check_out, wifi_details, amenities, cancellation_policy)
    status_record_id: number
    created_at?: string
    updated_at?: string
    deleted_at?: string
}

export interface ListingExternalId {
    id: number
    listing_id: number
    source_pms_id: number
    external_id: string
}

export interface ListingDocument {
    id: number
    listing_id: number
    listing_document_type_id: number
    content?: string
    status_record_id: number
    created_at?: string
    updated_at?: string
    deleted_at?: string
}

/**
 * @deprecated Use Listing instead. Kept for backward compatibility.
 */
export type Unit = Listing

export interface Guest {
    id: number
    uuid?: string
    name: string
    lastname: string
    nationality_id?: number
    gender_id?: number
    identification_type_id?: number
    identificacion_number?: string
    date_of_birth?: string
    email: string
    phone: string
    city_of_residence?: string
    country_of_residence_id?: number
    extra?: any
    created_at?: string
    updated_at?: string
}

export interface GuestVerification {
    id: number
    guest_id: number
    person_verification_id: number
    created_at?: string
    updated_at?: string
}

export interface Reservation {
    id: string | number
    uuid?: string
    reservation_source_id?: number
    listing_id?: number
    external_id?: string
    arrival_date?: string
    departure_date?: string
    guest_id?: number
    email_guest?: string
    total_guests?: number
    currency?: string
    total_price?: number
    extra?: any
    status_reservation_id?: number
    created_at?: string
    updated_at?: string
    deleted_at?: string
    
    // UI specific fields (to be mapped from related entities)
    guestName?: string
    propertyName?: string
    propertyId?: string | number
    unitName?: string
    unitId?: string | number
    checkIn?: string | Date
    checkOut?: string | Date
    nights?: number
    source?: string
    status?: string
    totalPrice?: number
    externalId?: string
    userId?: string | number
    automationStatus?: AutomationStatus
}

export interface ReservationGuest {
    id: number
    reservation_uuid: string
    guest_id: number
    external_id?: string
    extra?: any // document_country_id, country_of_origin_id, country_destination_id, city_of_origin, reason_for_trip_id, document_image_1, document_image_2
    created_at?: string
    updated_at?: string
}
