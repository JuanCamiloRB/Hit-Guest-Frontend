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
    id: string
    createdAt: string
    updatedAt: string
    name: string
    internalName: string
    description: string
    type: string
    status: "ACTIVE" | "INACTIVE"
    thumbnailUrl: string
    address: {
        line1: string
        line2?: string
        postal_code?: string
        city: string
        state?: string
        country: string
    }
    geoLocation: {
        latitude: number
        longitude: number
    }
    startPrice: number
    currency: string
    timeZone: string
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
    id: string
    propertyId: string
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
    status: "CONFIRMED" | "PENDING" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "LINK_SENT" | "PENDING_CONTRACT" | "NO_STARTED"
    source: "Airbnb" | "Booking" | "Direct"
    totalPrice: number
    automationStatus?: AutomationStatus
}
