import { Reservation } from "@/types"

export const mockDashboardReservations: Reservation[] = [
    {
        id: "RES-MG-001",
        guestName: "Maria González",
        propertyId: "P1",
        propertyName: "Apartamento Centro 201",
        unitId: "U1",
        unitName: "Apartamento Centro 201",
        checkIn: new Date("2026-02-15"),
        checkOut: new Date("2026-02-18"),
        nights: 3,
        source: "Airbnb",
        status: "LINK_SENT",
        totalPrice: 0, // Not shown in table
        userId: "U_MG"
    },
    {
        id: "RES-CR-002",
        guestName: "Carlos Ruiz",
        propertyId: "P2",
        propertyName: "Loft Moderno",
        unitId: "U2",
        unitName: "Loft Moderno",
        checkIn: new Date("2026-02-16"),
        checkOut: new Date("2026-02-20"),
        nights: 4,
        source: "Booking",
        status: "PENDING", // Check-in Pendiente mapped to PENDING or custom
        totalPrice: 0,
        userId: "U_CR"
    },
    {
        id: "RES-AB-003",
        guestName: "Ana Beltrán",
        propertyId: "P3",
        propertyName: "Suite Ejecutiva 504",
        unitId: "U3",
        unitName: "Suite Ejecutiva 504",
        checkIn: new Date("2026-02-15"),
        checkOut: new Date("2026-02-17"),
        nights: 2,
        source: "Airbnb",
        status: "CONFIRMED", // Completado mapped to CONFIRMED or CHECKED_OUT depending on logic, using CONFIRMED for green check
        totalPrice: 0,
        userId: "U_AB"
    },
    {
        id: "RES-JH-004",
        guestName: "Jorge Herrera",
        propertyId: "P4",
        propertyName: "Apartamento Centro 202",
        unitId: "U4",
        unitName: "Apartamento Centro 202",
        checkIn: new Date("2026-02-18"),
        checkOut: new Date("2026-02-22"),
        nights: 4,
        source: "Direct",
        status: "NO_STARTED",
        totalPrice: 0,
        userId: "U_JH"
    },
    {
        id: "RES-EP-005",
        guestName: "Elena Petro",
        propertyId: "P2",
        propertyName: "Loft Moderno",
        unitId: "U2",
        unitName: "Loft Moderno",
        checkIn: new Date("2026-02-14"),
        checkOut: new Date("2026-02-16"),
        nights: 2,
        source: "Airbnb",
        status: "CHECKED_OUT", // Salida (Check-out)
        totalPrice: 0,
        userId: "U_EP"
    },
    {
        id: "RES-LM-006",
        guestName: "Luis Méndez",
        propertyId: "P5",
        propertyName: "Suite Ejecutiva 501",
        unitId: "U5",
        unitName: "Suite Ejecutiva 501",
        checkIn: new Date("2026-02-20"),
        checkOut: new Date("2026-02-25"),
        nights: 5,
        source: "Booking",
        status: "PENDING_CONTRACT",
        totalPrice: 0,
        userId: "U_LM"
    }
]
