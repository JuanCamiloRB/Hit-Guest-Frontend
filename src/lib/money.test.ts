import { describe, expect, it } from "vitest"
import { formatMoney, formatMoneyText, readCurrencyCode } from "./money"

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

describe("formatMoneyText — monto que el backend manda como texto (contrato 2026-10-27 §7.5)", () => {
    it("«1000» y «1000.50» salen con el formato del panel, como formatMoney", () => {
        expect(formatMoneyText("1000", "USD")).toBe(formatMoney(1000, "USD"))
        expect(formatMoneyText("1000.50", "USD")).toBe(formatMoney(1000.5, "USD"))
    })

    it("algo fuera de esa forma no se adivina: va tal cual con la moneda", () => {
        expect(formatMoneyText("1.000,50", "USD")).toBe("USD 1.000,50")
        expect(formatMoneyText("mil", null)).toBe("mil")
    })
})
