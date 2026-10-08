import { describe, expect, it } from "vitest"
import {
    analyzeDeclaredPrice,
    declaredPriceError,
    describeCurrency,
    formatDeclaredPrice,
    parseDeclaredPrice,
} from "./declared-price"

const COP = "COP"

describe("parseDeclaredPrice — lo escrito se traduce al número que exige el backend", () => {
    it("formato español: punto de miles, coma decimal (caso 3 de QA)", () => {
        expect(parseDeclaredPrice("850.000,50", COP)).toBe(850000.5)
        expect(parseDeclaredPrice("850.000", COP)).toBe(850000)
        expect(parseDeclaredPrice("1.234.567", COP)).toBe(1234567)
        expect(parseDeclaredPrice("850000,5", COP)).toBe(850000.5)
    })

    it("formato inglés: coma de miles, punto decimal", () => {
        expect(parseDeclaredPrice("850,000.50", COP)).toBe(850000.5)
        expect(parseDeclaredPrice("850,000", COP)).toBe(850000)
    })

    it("un solo separador seguido de 1–2 dígitos es decimal", () => {
        expect(parseDeclaredPrice("850000.5", COP)).toBe(850000.5)
        expect(parseDeclaredPrice("1.50", COP)).toBe(1.5)
        expect(parseDeclaredPrice("0,50", COP)).toBe(0.5)
    })

    it("tolera indicadores de moneda si TODOS coinciden con la de la reserva", () => {
        expect(parseDeclaredPrice("$ 850.000", COP)).toBe(850000)      // «$» es ambiguo: lo resuelve el preview
        expect(parseDeclaredPrice("COP 850000", COP)).toBe(850000)
        expect(parseDeclaredPrice("850000 cop", COP)).toBe(850000)
        expect(parseDeclaredPrice("US$ 120.50", "USD")).toBe(120.5)
        expect(parseDeclaredPrice("€1.200,00", "EUR")).toBe(1200)
        expect(parseDeclaredPrice("€500 EUR", "EUR")).toBe(500)          // símbolo + código coincidentes
        expect(parseDeclaredPrice("$ 500 COP", COP)).toBe(500)
    })

    it("cualquier indicador que contradiga la moneda de la reserva invalida la entrada (P1)", () => {
        expect(parseDeclaredPrice("USD 500", COP)).toBeNull()
        expect(parseDeclaredPrice("ABC 500", COP)).toBeNull()
        expect(parseDeclaredPrice("€1.200", COP)).toBeNull()
        expect(parseDeclaredPrice("US$ 120", COP)).toBeNull()
        // El símbolo no se ignora porque haya un código al final que sí coincide.
        expect(parseDeclaredPrice("€500 COP", COP)).toBeNull()
        expect(parseDeclaredPrice("US$ 500 COP", COP)).toBeNull()
        expect(parseDeclaredPrice("£500 COP", COP)).toBeNull()
        expect(parseDeclaredPrice("€500 USD", "EUR")).toBeNull()
        // Sin moneda de reserva no hay contra qué validar un indicador explícito.
        expect(parseDeclaredPrice("COP 500", null)).toBeNull()
        expect(parseDeclaredPrice("500", null)).toBe(500)
    })

    it("dos códigos invalidan la entrada aunque coincidan", () => {
        expect(parseDeclaredPrice("USD 500 COP", COP)).toBeNull()
        expect(parseDeclaredPrice("COP 500 COP", COP)).toBeNull()
    })

    it("rechaza texto inválido en vez de limpiarlo y convertirlo en OTRO monto (P0)", () => {
        expect(parseDeclaredPrice("85O000", COP)).toBeNull()   // letra O
        expect(parseDeclaredPrice("1e3", COP)).toBeNull()
        expect(parseDeclaredPrice("−5", COP)).toBeNull()   // signo menos Unicode
        expect(parseDeclaredPrice("(500)", COP)).toBeNull()
        expect(parseDeclaredPrice("850.000,50 pesos", COP)).toBeNull()
        expect(parseDeclaredPrice("8 50.000", COP)).toBeNull()
        expect(parseDeclaredPrice("COP", COP)).toBeNull()
    })

    it("rechaza lo que el backend rechaza y lo que es ambiguo", () => {
        expect(parseDeclaredPrice("0", COP)).toBeNull()
        expect(parseDeclaredPrice("-5", COP)).toBeNull()
        expect(parseDeclaredPrice("abc", COP)).toBeNull()
        expect(parseDeclaredPrice("", COP)).toBeNull()
        // tres decimales: no es decimal (1–2) ni miles (el primer grupo tiene 6)
        expect(parseDeclaredPrice("850000.123", COP)).toBeNull()
        expect(parseDeclaredPrice("12.34.5", COP)).toBeNull()
        expect(parseDeclaredPrice("1,5,5", COP)).toBeNull()
        expect(parseDeclaredPrice("1.000,5,5", COP)).toBeNull()
    })
})

describe("analyzeDeclaredPrice — la razón del fallo viene discriminada", () => {
    it("distingue vacío, formato, moneda repetida, moneda distinta y fuera de rango", () => {
        expect(analyzeDeclaredPrice("", COP)).toEqual({ ok: false, reason: "empty" })
        expect(analyzeDeclaredPrice("85O000", COP)).toEqual({ ok: false, reason: "invalid_format" })
        expect(analyzeDeclaredPrice("12.34.5", COP)).toEqual({ ok: false, reason: "invalid_format" })
        expect(analyzeDeclaredPrice("COP 500 COP", COP)).toEqual({ ok: false, reason: "duplicate_currency" })
        expect(analyzeDeclaredPrice("USD 500", COP)).toEqual({ ok: false, reason: "currency_mismatch" })
        expect(analyzeDeclaredPrice("€500 COP", COP)).toEqual({ ok: false, reason: "currency_mismatch" })
        expect(analyzeDeclaredPrice("0", COP)).toEqual({ ok: false, reason: "out_of_range" })
        expect(analyzeDeclaredPrice("850.000,50", COP)).toEqual({ ok: true, value: 850000.5 })
    })
})

describe("declaredPriceError", () => {
    it("vacío pide el valor; formato inválido explica la forma; válido no dice nada", () => {
        expect(declaredPriceError("", COP)).toContain("Indícanos")
        expect(declaredPriceError("0", COP)).toContain("mayor que 0")
        expect(declaredPriceError("85O000", COP)).toContain("máximo dos decimales")
        expect(declaredPriceError("850.000,50", COP)).toBeNull()
    })

    it("una moneda contradictoria se explica con nombre propio; dos códigos NO se confunden con eso", () => {
        expect(declaredPriceError("USD 500", COP)).toBe("El valor debe declararse en COP, la moneda de tu reserva.")
        expect(declaredPriceError("€ 1.200", COP)).toContain("COP")
        expect(declaredPriceError("COP 500 COP", COP)).toBe("Indica la moneda una sola vez, o escribe solo el número.")
        expect(declaredPriceError("COP 500", null)).toBe("Escribe solo el número, sin moneda.")
    })
})

describe("formatDeclaredPrice / describeCurrency — la moneda viene de la reserva", () => {
    it("muestra el valor con la moneda de la reserva en formato es-CO", () => {
        expect(formatDeclaredPrice(850000.5, "COP")).toMatch(/850\.000,5/)
        expect(formatDeclaredPrice(850000.5, "COP")).toMatch(/\$|COP/)
        expect(formatDeclaredPrice(120, "USD")).toMatch(/120/)
    })

    it("sin moneda o con una que Intl no conoce, no revienta", () => {
        expect(formatDeclaredPrice(850000, null)).toBe("850.000")
        expect(formatDeclaredPrice(850000, "XXQ")).toMatch(/850\.000/)
        expect(formatDeclaredPrice(850000, "XXQ")).toMatch(/XXQ/)
        expect(formatDeclaredPrice(850000, "not-a-code")).toBe("850.000")
        expect(describeCurrency("COP")).toMatch(/peso/i)
        expect(describeCurrency(null)).toBeNull()
    })
})
