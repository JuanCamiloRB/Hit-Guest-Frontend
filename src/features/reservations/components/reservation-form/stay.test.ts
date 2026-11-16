import { describe, expect, it } from "vitest"
import { nightsBetween, prefillFromListing, pricePerNight, readListingDefaults } from "./stay"

describe("nightsBetween / pricePerNight", () => {
    it("cuenta noches solo con las dos fechas; un día solo o al revés es 0", () => {
        expect(nightsBetween(new Date(2026, 11, 12), new Date(2026, 11, 15))).toBe(3)
        expect(nightsBetween(new Date(2026, 11, 12), undefined)).toBe(0)
        expect(nightsBetween(new Date(2026, 11, 15), new Date(2026, 11, 12))).toBe(0)
    })

    it("el precio por noche solo existe con precio y noches", () => {
        expect(pricePerNight(650000, 3)).toBeCloseTo(216666.67, 1)
        expect(pricePerNight(0, 3)).toBeNull()
        expect(pricePerNight(650000, 0)).toBeNull()
        expect(pricePerNight(null, 3)).toBeNull()
    })
})

describe("readListingDefaults — lo que sugiere el alojamiento", () => {
    it("lee las formas camel, snake y plana; sin valor usable queda null", () => {
        expect(readListingDefaults({ extra: { maxOccupancy: 4, startPrice: 650000, currency: "COP" } }))
            .toEqual({ guests: 4, price: 650000, currency: "COP" })
        expect(readListingDefaults({ extra: { max_occupancy: 2, start_price: "380" }, currency: "USD" }))
            .toEqual({ guests: 2, price: 380, currency: "USD" })
        expect(readListingDefaults({ maxOccupancy: 0, price: 0 })).toEqual({ guests: null, price: null, currency: null })
        expect(readListingDefaults(null)).toEqual({ guests: null, price: null, currency: null })
    })
})

describe("prefillFromListing — solo llena lo que el PM no tocó", () => {
    const defaults = { guests: 4, price: 650000, currency: "COP" }

    it("sin tocar nada, sugiere los tres (el precio como texto para el campo)", () => {
        expect(prefillFromListing(defaults, { totalGuests: false, totalPrice: false, currency: false }))
            .toEqual({ totalGuests: 4, totalPrice: "650000", currency: "COP" })
    })

    it("lo tocado se respeta aunque la respuesta llegue tarde", () => {
        expect(prefillFromListing(defaults, { totalGuests: true, totalPrice: true, currency: false }))
            .toEqual({ currency: "COP" })
    })

    it("sin sugerencia no se toca nada", () => {
        expect(prefillFromListing({ guests: null, price: null, currency: null }, { totalGuests: false, totalPrice: false, currency: false }))
            .toEqual({})
    })
})
