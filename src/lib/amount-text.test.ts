import { describe, expect, it } from "vitest"
import { hasAmountSeparator, parseAmountText } from "./amount-text"

describe("parseAmountText — lo escrito, sin adivinar separadores", () => {
    it("entero sin separadores", () => {
        expect(parseAmountText("650000")).toBe(650000)
        expect(parseAmountText(" 0 ")).toBe(0)
    })

    it("un solo separador seguido de 3 dígitos agrupa miles; seguido de 1–2 es decimal", () => {
        // El caso que se cobraba por 650: seiscientos cincuenta mil a la colombiana.
        expect(parseAmountText("650.000")).toBe(650000)
        expect(parseAmountText("650,000")).toBe(650000)
        expect(parseAmountText("1.234.567")).toBe(1234567)
        expect(parseAmountText("650.5")).toBe(650.5)
        expect(parseAmountText("650,50")).toBe(650.5)
        expect(parseAmountText("12.5")).toBe(12.5)
    })

    it("los dos separadores: el último es el decimal y el otro agrupa de a 3", () => {
        expect(parseAmountText("1.234,56")).toBe(1234.56)
        expect(parseAmountText("1,234.56")).toBe(1234.56)
        expect(parseAmountText("1.234,5")).toBe(1234.5)
    })

    it("ambiguo o mal formado → null, nunca un número adivinado", () => {
        expect(parseAmountText("650.0000")).toBeNull()
        expect(parseAmountText("1.23.4")).toBeNull()
        expect(parseAmountText("1,234,56")).toBeNull()
        expect(parseAmountText("12.345,678")).toBeNull()
        expect(parseAmountText("1e3")).toBeNull()
        expect(parseAmountText("$ 100")).toBeNull()
        expect(parseAmountText("")).toBeNull()
        expect(parseAmountText(".")).toBeNull()
    })

    it("hasAmountSeparator dice cuándo conviene mostrar cómo se leyó", () => {
        expect(hasAmountSeparator("650000")).toBe(false)
        expect(hasAmountSeparator("650.000")).toBe(true)
        expect(hasAmountSeparator("650,5")).toBe(true)
    })
})
