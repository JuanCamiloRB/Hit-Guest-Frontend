import { describe, expect, it } from "vitest"
import { readReservationChannel } from "./reservation-channel"

describe("readReservationChannel — el canal real, nunca colapsado en «Direct»", () => {
    it("conserva el nombre de cualquier canal, no solo Airbnb y Booking", () => {
        expect(readReservationChannel({ source: { id: 26, name: "Expedia", slug: "expedia" } })).toEqual({ name: "Expedia", slug: "expedia" })
        expect(readReservationChannel({ source: { id: 851, name: "Trip.com", slug: "trip_com" } })).toEqual({ name: "Trip.com", slug: "trip_com" })
        expect(readReservationChannel({ source: { id: 24, name: "Vrbo" } })).toEqual({ name: "Vrbo", slug: "vrbo" })
    })

    it("con traducciones muestra el español", () => {
        expect(readReservationChannel({ source: { id: 21, name: { en: "Direct", es: "Directo" }, slug: "direct" } })?.name).toBe("Directo")
        expect(readReservationChannel({ source: { id: 107, name: "Unknown", name_translations: { es: "Desconocido" } } })?.name).toBe("Desconocido")
    })

    it("sin canal informado devuelve null (no se asume Directo)", () => {
        expect(readReservationChannel({})).toBeNull()
        expect(readReservationChannel({ source: null })).toBeNull()
        expect(readReservationChannel({ source: { id: 999 } })).toBeNull()
    })

    it("bordes: la traducción gana al nombre plano, el slug se normaliza, solo id usa el respaldo", () => {
        expect(readReservationChannel({ source: { id: 23, name: "Booking", name_translations: { es: "Booking.com" } } })?.name).toBe("Booking.com")
        expect(readReservationChannel({ source: { id: 22, name: "Airbnb", slug: "AIRBNB" } })?.slug).toBe("airbnb")
        expect(readReservationChannel({ source: { id: 21 } })).toEqual({ name: "direct", slug: "direct" })
        expect(readReservationChannel({ source: { id: 107, name: "Desconocido" } })).toEqual({ name: "Desconocido", slug: "unknown" })
    })
})
