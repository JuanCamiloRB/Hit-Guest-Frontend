import { describe, expect, it } from "vitest"
import { formatMoney, readCurrencyCode } from "./money"

describe("formatMoney", () => {
    it("nombra la moneda real (símbolo o código según el locale), nunca «$» para todo", () => {
        expect(formatMoney(850000.5, "COP")).toMatch(/850\.000,5/)
        // es-CO escribe las monedas extranjeras con su código: «EUR 1.200,00».
        expect(formatMoney(1200, "EUR")).toMatch(/€|EUR/)
        expect(formatMoney(1200, "EUR")).not.toMatch(/\$/)
        expect(formatMoney(1200, "GBP")).toMatch(/£|GBP/)
        expect(formatMoney(1200, "GBP")).not.toMatch(/\$/)
    })

    it("sin moneda devuelve solo el número: no inventa COP", () => {
        expect(formatMoney(850000, null)).toBe("850.000")
        expect(formatMoney(850000, undefined)).toBe("850.000")
        expect(formatMoney(850000, "")).toBe("850.000")
    })
})

describe("readCurrencyCode", () => {
    it("acepta solo códigos de tres letras y toma el primero presente", () => {
        expect(readCurrencyCode(undefined, "cop")).toBe("COP")
        expect(readCurrencyCode("", null, "USD")).toBe("USD")
        expect(readCurrencyCode("pesos", 12, null)).toBeNull()
    })
})
