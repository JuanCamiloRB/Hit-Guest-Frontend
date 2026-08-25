export type Role = "ADMIN" | "STAFF" | "GUEST"

export interface AutomationStatus {
    link: "success" | "pending" | "none"
    checkin: "success" | "pending" | "none"
    contract: "success" | "pending" | "none"
    code: "success" | "pending" | "none"
    tra: "success" | "pending" | "none"
    // SIRE has two independent automations: check-in (order 7) and check-out
    // (order 8). They can run under different rules, so each gets its own light.
    sireIn: "success" | "pending" | "none"
    sireOut: "success" | "pending" | "none"
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
    id: string | number
    uuid: string
    createdAt: string
    updatedAt: string
    name: string
    description?: string
    type: string
    status: "ACTIVE" | "INACTIVE"
    thumbnailUrl?: string
    address: {
        line1: string
        line2?: string
        postal_code?: string
        city: string
        state?: string
        country: string
    }
    geoLocation?: {
        latitude: number
        longitude: number
    }
    startPrice?: number
    currency?: string
    timeZone?: string
    rating?: {
        average: number
        count: number
    }
    roomTypes?: {
        id: string | number
        name: string
    }[]
}

export interface Unit {
    id: string | number
    uuid?: string
    propertyId: string | number
    name: string
    number: string
    type: "ENTIRE_PLACE" | "PRIVATE_ROOM" | "SHARED_ROOM"
    capacity: number
    amenities: string[]
    pricePerNight: number
    status: "ACTIVE" | "INACTIVE"
    inheritWifi: boolean
    wifiNetwork?: string
    wifiPassword?: string
}

export interface Reservation {
    id: string
    guestName: string
    email?: string
    phone?: string
    propertyId: string
    propertyName: string
    unitId: string
    unitName: string
    userId?: string
    checkIn: Date
    checkOut: Date
    nights: number
    /**
     * HitGuest-internal reservation status (catalog_category_id 7), NOT a PMS status.
     * Only CONFIRMED (27) and IN_PROGRESS (28) enable the reservation's automations.
     * The remaining members are legacy operational values kept for older consumers.
     */
    status: "CONFIRMED" | "IN_PROGRESS" | "CANCELLED" | "CLOSED" | "DELETED" | "UNKNOWN" | "PENDING" | "CHECKED_IN" | "CHECKED_OUT" | "LINK_SENT" | "PENDING_CONTRACT" | "NO_STARTED"
    source: "Airbnb" | "Booking" | "Direct"
    totalPrice: number
    automationStatus?: AutomationStatus
    /** Huéspedes esperados en la reserva (`total_guests`). */
    totalGuests?: number
    /**
     * Huéspedes que ya completaron su check-in.
     *
     * `undefined` significa "el backend no lo reportó", que NO es lo mismo que
     * cero: la columna CHECK-IN vuelve a su etiqueta binaria en ese caso en vez
     * de afirmar que no ha llegado nadie.
     */
    completedGuests?: number
}
