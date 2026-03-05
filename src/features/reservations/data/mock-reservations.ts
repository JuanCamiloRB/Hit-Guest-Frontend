import { Reservation } from "@/types"

export const mockReservations: Reservation[] = [
    {
        id: "RES-001",
        propertyId: "1",
        unitId: "101",
        userId: "u1",
        propertyName: "Casa Rosada",
        unitName: "Suite Principal",
        guestName: "Alice Johnson",
        checkIn: new Date("2026-03-01"),
        checkOut: new Date("2026-03-05"),
        status: "CONFIRMED",
        nights: 4,
        source: "Airbnb",
        totalPrice: 480.00
    },
    {
        id: "RES-002",
        propertyId: "1",
        unitId: "102",
        userId: "u2",
        propertyName: "Casa Rosada",
        unitName: "Habitación Colonial",
        guestName: "Bob Smith",
        checkIn: new Date("2026-03-10"),
        checkOut: new Date("2026-03-12"),
        status: "PENDING",
        nights: 2,
        source: "Booking",
        totalPrice: 190.00
    },
    {
        id: "RES-003",
        propertyId: "2",
        unitId: "502",
        userId: "u3",
        propertyName: "Apartamento 502",
        unitName: "Entire Apartment",
        guestName: "Charlie Davis",
        checkIn: new Date("2026-02-28"),
        checkOut: new Date("2026-03-02"),
        status: "CHECKED_IN",
        nights: 2,
        source: "Direct",
        totalPrice: 250.00
    },
    {
        id: "RES-004",
        propertyId: "1",
        unitId: "101",
        userId: "u4",
        propertyName: "Casa Rosada",
        unitName: "Suite Principal",
        guestName: "Diana Prince",
        checkIn: new Date("2026-03-15"),
        checkOut: new Date("2026-03-20"),
        status: "CONFIRMED",
        nights: 5,
        source: "Airbnb",
        totalPrice: 600.00
    }
]
