import { Reservation } from "@/types"

export interface ActivityEvent {
    id: string
    title: string
    timestamp: string
    type: "success" | "info" | "action"
    source: string
}

export interface AutomationStatus {
    link: "success" | "pending" | "none"
    checkin: "success" | "pending" | "none"
    contract: "success" | "pending" | "none"
    code: "success" | "pending" | "none"
    tra: "success" | "pending" | "none"
    sire: "success" | "pending" | "none"
}

export interface ReservationDetail extends Reservation {
    externalId: string
    automationStatus: AutomationStatus
    activityLog: ActivityEvent[]
    breakdown: {
        alojamiento: number
        limpieza: number
    }
}

export const detailedMockReservations: Record<string, ReservationDetail> = {
    "RES-MG-001": {
        id: "RES-MG-001",
        guestName: "Maria González",
        propertyId: "P1",
        propertyName: "Apartamento Centro",
        unitId: "U1",
        unitName: "Unidad 201 • Planta 2",
        checkIn: new Date("2026-02-15T15:00:00"),
        checkOut: new Date("2026-02-18T11:00:00"),
        nights: 3,
        source: "Airbnb",
        status: "CONFIRMED",
        totalPrice: 450000,
        userId: "U_MG",
        externalId: "#123456789",
        automationStatus: {
            link: "success",
            checkin: "success",
            contract: "success",
            code: "pending",
            tra: "pending",
            sire: "none",
        },
        activityLog: [
            { id: "1", title: "Check-in online completado", timestamp: "Hace 2 horas", type: "success", source: "Huésped (App)" },
            { id: "2", title: "Enlace de reserva enviado", timestamp: "Hace 1 día", type: "info", source: "Automático" },
            { id: "3", title: "Reserva creada", timestamp: "Hace 1 día", type: "info", source: "Airbnb Integration" },
        ],
        breakdown: {
            alojamiento: 400000,
            limpieza: 50000,
        }
    },
    "RES-CR-002": {
        id: "RES-CR-002",
        guestName: "Carlos Ruiz",
        propertyId: "P2",
        propertyName: "Loft Moderno",
        unitId: "U2",
        unitName: "Piso 5 • Vista Ciudad",
        checkIn: new Date("2026-02-16T15:00:00"),
        checkOut: new Date("2026-02-20T11:00:00"),
        nights: 4,
        source: "Booking",
        status: "PENDING",
        totalPrice: 800000,
        userId: "U_CR",
        externalId: "#BK-987654321",
        automationStatus: {
            link: "success",
            checkin: "pending",
            contract: "pending",
            code: "none",
            tra: "none",
            sire: "none",
        },
        activityLog: [
            { id: "1", title: "Enlace de reserva enviado", timestamp: "Hace 3 horas", type: "info", source: "Automático" },
            { id: "2", title: "Reserva creada", timestamp: "Hace 5 horas", type: "info", source: "Booking.com" },
        ],
        breakdown: {
            alojamiento: 720000,
            limpieza: 80000,
        }
    },
    "RES-AB-003": {
        id: "RES-AB-003",
        guestName: "Ana Beltrán",
        propertyId: "P3",
        propertyName: "Suite Ejecutiva 504",
        unitId: "U3",
        unitName: "Suite Ejecutiva 504",
        checkIn: new Date("2026-02-15T15:00:00"),
        checkOut: new Date("2026-02-17T11:00:00"),
        nights: 2,
        source: "Airbnb",
        status: "CONFIRMED",
        totalPrice: 320000,
        userId: "U_AB",
        externalId: "#456789123",
        automationStatus: {
            link: "success",
            checkin: "success",
            contract: "success",
            code: "success",
            tra: "success",
            sire: "none",
        },
        activityLog: [
            { id: "1", title: "Check-in online completado", timestamp: "Hace 10 horas", type: "success", source: "Huésped (App)" },
            { id: "2", title: "Reserva creada", timestamp: "Hace 2 días", type: "info", source: "Airbnb Integration" },
        ],
        breakdown: {
            alojamiento: 280000,
            limpieza: 40000,
        }
    },
    "RES-JH-004": {
        id: "RES-JH-004",
        guestName: "Jorge Herrera",
        propertyId: "P4",
        propertyName: "Apartamento Centro 202",
        unitId: "U4",
        unitName: "Apartamento Centro 202",
        checkIn: new Date("2026-02-18T15:00:00"),
        checkOut: new Date("2026-02-22T11:00:00"),
        nights: 4,
        source: "Direct",
        status: "NO_STARTED",
        totalPrice: 600000,
        userId: "U_JH",
        externalId: "#DIR-0004",
        automationStatus: {
            link: "pending",
            checkin: "none",
            contract: "pending",
            code: "none",
            tra: "none",
            sire: "none",
        },
        activityLog: [
            { id: "1", title: "Reserva creada manualmente", timestamp: "Hace 1 hora", type: "action", source: "Admin Panel" },
        ],
        breakdown: {
            alojamiento: 550000,
            limpieza: 50000,
        }
    },
    "RES-EP-005": {
        id: "RES-EP-005",
        guestName: "Elena Petro",
        propertyId: "P2",
        propertyName: "Loft Moderno",
        unitId: "U2",
        unitName: "Loft Moderno",
        checkIn: new Date("2026-02-14T15:00:00"),
        checkOut: new Date("2026-02-16T11:00:00"),
        nights: 2,
        source: "Airbnb",
        status: "CHECKED_OUT",
        totalPrice: 400000,
        userId: "U_EP",
        externalId: "#987654321",
        automationStatus: {
            link: "success",
            checkin: "success",
            contract: "success",
            code: "success",
            tra: "success",
            sire: "success",
        },
        activityLog: [
            { id: "1", title: "Huésped realizó checkout", timestamp: "Ayer", type: "success", source: "Sistema" },
        ],
        breakdown: {
            alojamiento: 350000,
            limpieza: 50000,
        }
    },
    "RES-LM-006": {
        id: "RES-LM-006",
        guestName: "Luis Méndez",
        propertyId: "P5",
        propertyName: "Suite Ejecutiva 501",
        unitId: "U5",
        unitName: "Suite Ejecutiva 501",
        checkIn: new Date("2026-02-20T15:00:00"),
        checkOut: new Date("2026-02-25T11:00:00"),
        nights: 5,
        source: "Booking",
        status: "PENDING_CONTRACT",
        totalPrice: 1200000,
        userId: "U_LM",
        externalId: "#BK-11223344",
        automationStatus: {
            link: "success",
            checkin: "pending",
            contract: "pending",
            code: "none",
            tra: "none",
            sire: "none",
        },
        activityLog: [
            { id: "1", title: "Enviado recordatorio de contrato", timestamp: "Hace 15 min", type: "info", source: "Automático" },
        ],
        breakdown: {
            alojamiento: 1100000,
            limpieza: 100000,
        }
    }
}
