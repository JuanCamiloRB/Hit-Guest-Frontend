import { describe, it, expect } from "vitest"
import { bookingBlock, checkinLinkBlockedReason, reservationOperability, statusTag } from "./reservation-availability"

describe("bookingBlock — solo se reserva en propiedad y alojamiento activos", () => {
    it("ambos activos: se puede", () => {
        expect(bookingBlock("active", "active")).toBeNull()
    })

    it("la propiedad manda: inactiva, ningún alojamiento sirve (precedencia del backend)", () => {
        expect(bookingBlock("inactive", "inactive")).toBe("property_inactive")
        expect(bookingBlock("inactive", "active")).toBe("property_inactive")
    })

    it("alojamiento inactivo", () => {
        expect(bookingBlock("active", "inactive")).toBe("listing_inactive")
    })

    it("un estado desconocido bloquea: nunca se asume activo", () => {
        expect(bookingBlock("unknown", "active")).toBe("property_unknown")
        expect(bookingBlock("active", "unknown")).toBe("listing_unknown")
    })

    it("sin alojamiento elegido todavía, solo mira la propiedad", () => {
        expect(bookingBlock("active", null)).toBeNull()
    })
})

describe("reservationOperability — la regla depende de la operación (contrato 2026-10-27 §2.1)", () => {
    it("crear exige todo activo", () => {
        expect(reservationOperability({ operation: "create", propertyStatus: "active", listingStatus: "active" })).toEqual({ allowed: true })
        expect(reservationOperability({ operation: "create", propertyStatus: "active", listingStatus: "inactive" }))
            .toMatchObject({ allowed: false, reason: "listing_inactive" })
    })

    it("editar sin mover se permite aunque el alojamiento esté inactivo", () => {
        expect(reservationOperability({ operation: "edit", propertyStatus: "inactive", listingStatus: "inactive", listingChanged: false }))
            .toEqual({ allowed: true })
    })

    it("mover exige que el DESTINO esté activo", () => {
        expect(reservationOperability({ operation: "edit", propertyStatus: "active", listingStatus: "active", listingChanged: true }))
            .toEqual({ allowed: true })
        expect(reservationOperability({ operation: "edit", propertyStatus: "inactive", listingStatus: "active", listingChanged: true }))
            .toMatchObject({ allowed: false, reason: "property_inactive" })
        expect(reservationOperability({ operation: "edit", propertyStatus: "active", listingStatus: "unknown", listingChanged: true }))
            .toMatchObject({ allowed: false, reason: "listing_unknown" })
    })
})

describe("statusTag", () => {
    it("marca inactivas y desconocidas; nada en las activas", () => {
        expect(statusTag("inactive", true)).toBe("Inactiva")
        expect(statusTag("inactive", false)).toBe("Inactivo")
        expect(statusTag("unknown", true)).toBe("Estado sin confirmar")
        expect(statusTag("active", true)).toBeNull()
    })
})

describe("checkinLinkBlockedReason — `listing.inactiveReason` (contrato 2026-10-27 §7.3)", () => {
    it("con el alojamiento o la propiedad inactivos no sale el link, y se dice por qué", () => {
        expect(checkinLinkBlockedReason("LISTING_INACTIVE")).toMatch(/alojamiento de esta reserva está inactivo/)
        expect(checkinLinkBlockedReason("PROPERTY_INACTIVE")).toMatch(/propiedad de esta reserva está inactiva/)
    })

    it("operable, o un backend que no lo informa: no lo bloquea (decide el 422)", () => {
        expect(checkinLinkBlockedReason(null)).toBeNull()
        expect(checkinLinkBlockedReason(undefined)).toBeNull()
    })
})
