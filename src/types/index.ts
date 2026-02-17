export type Role = "ADMIN" | "STAFF" | "GUEST"

export interface User {
    id: string
    name: string
    email: string
    phone?: string
    role: Role
    status: "ACTIVE" | "INACTIVE"
    avatarUrl?: string
}

export interface Property {
    id: string
    name: string
    address: string
    city: string
    country: string
    imageUrl?: string
    status: "ACTIVE" | "INACTIVE"
}

export interface Unit {
    id: string
    propertyId: string
    name: string
    type: "ENTIRE_PLACE" | "PRIVATE_ROOM" | "SHARED_ROOM"
    amenities: string[]
    pricePerNight: number
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
    status: "CONFIRMED" | "PENDING" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT"
    totalPrice: number
}
