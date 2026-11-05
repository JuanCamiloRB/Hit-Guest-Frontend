import { describe, expect, it } from "vitest"
import type { Portfolio } from "@/features/properties/lib/properties-cache"
import type { Reservation } from "@/types"
import { UNKNOWN_PROPERTY_LABEL, unitLabel, withListingNames } from "./listing-names"

const row = (over: Partial<Reservation>) =>
    ({ id: "r", unitId: "", propertyId: "", propertyName: "", unitName: "Alojamiento", ...over }) as Reservation

// La forma que produce `toListing`/`toProperty`: el alojamiento apunta a su
// propiedad por uuid (`_propertyUuid` del BFF).
const portfolio = {
    properties: [{ id: "p-1", uuid: "p-1", name: "Casa Mar" }],
    listings: [
        { id: "l-1", uuid: "l-1", propertyId: "p-1", name: "Suite", number: "101" },
        { id: "l-3", uuid: "l-3", propertyId: "p-borrada", name: "Cabaña", number: "" },
        // Sin uuid, `toListing` le da `id = String(index + 1)`: no puede casar
        // con un `listingId` numérico de la reserva.
        { id: "1", propertyId: "p-1", name: "Otra", number: "" },
    ],
    overview: {},
} as unknown as Portfolio

describe("unitLabel", () => {
    it("une nombre y nombre interno; sin nombre dice «Alojamiento»", () => {
        expect(unitLabel("Suite", "101")).toBe("Suite (101)")
        expect(unitLabel(" Suite ", "  ")).toBe("Suite")
        expect(unitLabel(null, undefined)).toBe("Alojamiento")
    })
})

describe("withListingNames — el portafolio completa las filas", () => {
    it("sin portafolio (todavía no respondió) devuelve las mismas filas, sin copiar", () => {
        const rows = [row({ unitId: "l-1" })]
        expect(withListingNames(rows, null)).toBe(rows)
    })

    it("completa propiedad (con su uuid) y alojamiento", () => {
        const [a] = withListingNames([row({ unitId: "l-1" })], portfolio)
        expect(a).toMatchObject({ propertyId: "p-1", propertyName: "Casa Mar", unitName: "Suite (101)" })
    })

    it("con el portafolio ya respondido, lo que nadie conoce dice «Propiedad no disponible» — nunca el alojamiento", () => {
        const [x, y, z] = withListingNames([row({ unitId: "l-x" }), row({ unitId: "l-3" }), row({ unitId: "1" })], portfolio)
        expect(x.propertyName).toBe(UNKNOWN_PROPERTY_LABEL)
        expect(y).toMatchObject({ propertyId: "", propertyName: UNKNOWN_PROPERTY_LABEL, unitName: "Cabaña" })
        expect(z).toMatchObject({ propertyName: UNKNOWN_PROPERTY_LABEL, unitName: "Alojamiento" })
    })

    it("lo que trajo la reserva se conserva si el portafolio no lo mejora", () => {
        const conPropiedad = row({ unitId: "l-x", propertyId: "p-9", propertyName: "Del payload" })
        const [x] = withListingNames([conPropiedad], portfolio)
        expect(x).toBe(conPropiedad)
    })
})
