import { describe, it, expect } from "vitest"
import type { Reservation } from "@/types"
import {
    RESERVATION_STATUS_META,
    getReservationStatusMeta,
    isReservationActionable,
    isExternalReservation,
    formatGuestName,
    guestInitials,
} from "./reservation-status-meta"

const ALL_STATUSES: Reservation["status"][] = [
    "CONFIRMED",
    "IN_PROGRESS",
    "CANCELLED",
    "CLOSED",
    "DELETED",
    "UNKNOWN",
    "PENDING",
    "CHECKED_IN",
    "CHECKED_OUT",
    "LINK_SENT",
    "PENDING_CONTRACT",
    "NO_STARTED",
]

describe("getReservationStatusMeta", () => {
    it("covers every status in the union", () => {
        for (const status of ALL_STATUSES) {
            expect(RESERVATION_STATUS_META[status], status).toBeDefined()
        }
    })

    // El panel renderizaba `status === "CONFIRMED" ? "CONFIRMADA" : "PENDIENTE"`,
    // así que una reserva cancelada se le mostraba al operador como pendiente,
    // es decir, como algo sobre lo que todavía había que actuar.
    it("no longer collapses non-confirmed statuses into 'pendiente'", () => {
        expect(getReservationStatusMeta("CANCELLED").label).toBe("Cancelada")
        expect(getReservationStatusMeta("CLOSED").label).toBe("Finalizada")
        expect(getReservationStatusMeta("DELETED").label).toBe("Eliminada")
    })

    it("gives failed-ish statuses the danger tone and healthy ones success", () => {
        expect(getReservationStatusMeta("CANCELLED").tone).toBe("danger")
        expect(getReservationStatusMeta("DELETED").tone).toBe("danger")
        expect(getReservationStatusMeta("CONFIRMED").tone).toBe("success")
    })

    it("falls back to UNKNOWN for a status the backend adds later", () => {
        const rogue = "SOMETHING_NEW" as Reservation["status"]
        expect(getReservationStatusMeta(rogue)).toBe(RESERVATION_STATUS_META.UNKNOWN)
    })
})

describe("isReservationActionable", () => {
    it("blocks guest actions once the reservation is void or over", () => {
        expect(isReservationActionable("CANCELLED")).toBe(false)
        expect(isReservationActionable("CLOSED")).toBe(false)
        expect(isReservationActionable("DELETED")).toBe(false)
        expect(isReservationActionable("CHECKED_OUT")).toBe(false)
    })

    it("allows them while the stay is still ahead or running", () => {
        expect(isReservationActionable("CONFIRMED")).toBe(true)
        expect(isReservationActionable("IN_PROGRESS")).toBe(true)
        expect(isReservationActionable("CHECKED_IN")).toBe(true)
    })

    // Una allow-list de CONFIRMED/IN_PROGRESS habría desactivado "reenviar link"
    // justo en las reservas que más lo necesitan.
    it("keeps the check-in flow states actionable", () => {
        expect(isReservationActionable("PENDING")).toBe(true)
        expect(isReservationActionable("LINK_SENT")).toBe(true)
        expect(isReservationActionable("PENDING_CONTRACT")).toBe(true)
        expect(isReservationActionable("NO_STARTED")).toBe(true)
    })
})

describe("isExternalReservation", () => {
    it("treats only channel-manager sources as external", () => {
        expect(isExternalReservation("Airbnb")).toBe(true)
        expect(isExternalReservation("Booking")).toBe(true)
        expect(isExternalReservation("Direct")).toBe(false)
    })

    /**
     * Responde por el CANAL COMERCIAL, no por cómo entró la reserva al sistema.
     *
     * Confundir las dos cosas costó un bug real (2026-08-19): «Editar reserva»
     * se deshabilitaba con `source === "Airbnb"` y la reserva `MANUAL-5ZOBAR`
     * —creada a mano en el dashboard, con `externalId` generado por este mismo
     * frontend— quedaba bloqueada como si Airbnb la hubiera importado. Junto al
     * bloqueo se mostraban un badge «Importada por iCal» y un «Importada desde
     * Airbnb», ambos derivados de este mismo booleano.
     *
     * El backend NO expone el origen de una reserva: `source` es el canal, y
     * `source_pms` (100 Airbnb / 101 Booking / 134 KunasPMS) solo existe a nivel
     * Listing, en `externalPmsIds[]` — ver `BACKEND_NEEDS_RESERVATION_ORIGIN.md`.
     *
     * Hasta que exista ese campo, nada puede deducir de acá que una reserva fue
     * importada, ni bloquear su edición.
     */
    it("no autoriza a deducir el origen ni a bloquear la edición", () => {
        // Un canal externo NO implica que la reserva la haya importado ese canal:
        // el PM pudo crearla a mano y elegir ese canal.
        expect(isExternalReservation("Airbnb")).toBe(true)
        // Y si alguna vez sirviera para bloquear, tendría que valer igual para
        // Booking — que también se sincroniza y nunca estuvo bloqueado. Esa
        // asimetría era la señal de que la regla estaba inventada.
        expect(isExternalReservation("Booking")).toBe(isExternalReservation("Airbnb"))
    })
})

describe("formatGuestName", () => {
    it("title-cases names arriving lowercase from the PMS", () => {
        expect(formatGuestName("carolina rodriguez")).toBe("Carolina Rodriguez")
    })

    it("tames all-caps names", () => {
        expect(formatGuestName("CAROLINA RODRIGUEZ")).toBe("Carolina Rodriguez")
    })

    it("collapses stray whitespace", () => {
        expect(formatGuestName("  juan   camilo  ")).toBe("Juan Camilo")
    })

    it("leaves short all-caps particles alone", () => {
        expect(formatGuestName("maria DE la cruz")).toBe("Maria DE La Cruz")
    })
})

describe("guestInitials", () => {
    it("takes first and last initial", () => {
        expect(guestInitials("Carolina Rodriguez")).toBe("CR")
    })

    // El panel hacía `split(" ").map(n => n[0]).join("")`, que en un nombre de
    // cuatro palabras devolvía cuatro letras y desbordaba el avatar.
    it("stays at two letters for long names", () => {
        expect(guestInitials("Maria Del Carmen Rodriguez")).toBe("MR")
    })

    it("handles a single name and an empty one", () => {
        expect(guestInitials("Carolina")).toBe("CA")
        expect(guestInitials("   ")).toBe("?")
    })
})
