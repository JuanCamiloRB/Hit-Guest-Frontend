import { describe, it, expect } from "vitest"
import { isDocumentExpired } from "./document-expiry"

const HOY = new Date(2026, 7, 8) // 8-ago-2026, hora local

describe("isDocumentExpired", () => {
    it("detecta un documento vencido", () => {
        expect(isDocumentExpired("2026-08-07", HOY)).toBe(true)
        expect(isDocumentExpired("2020-01-01", HOY)).toBe(true)
    })

    it("acepta un documento vigente", () => {
        expect(isDocumentExpired("2026-08-09", HOY)).toBe(false)
        expect(isDocumentExpired("2030-12-31", HOY)).toBe(false)
    })

    it("el que vence HOY todavía sirve", () => {
        // Estrictamente anterior a hoy. Bloquear el último día válido sería
        // rechazar a alguien que el backend sí acepta.
        expect(isDocumentExpired("2026-08-08", HOY)).toBe(false)
    })

    describe("no bloquea cuando no puede afirmarlo", () => {
        it("sin fecha", () => {
            expect(isDocumentExpired(null, HOY)).toBe(false)
            expect(isDocumentExpired(undefined, HOY)).toBe(false)
            expect(isDocumentExpired("", HOY)).toBe(false)
        })

        it("con un formato que no entiende", () => {
            expect(isDocumentExpired("08/08/2020", HOY)).toBe(false)
            expect(isDocumentExpired("no-es-fecha", HOY)).toBe(false)
        })
    })

    it("compara por día calendario, no por instante UTC", () => {
        // `new Date("2026-08-08")` es medianoche UTC; en zonas al oeste de
        // Greenwich eso daría por vencido un documento que todavía sirve.
        const tardeEnElDia = new Date(2026, 7, 8, 23, 59, 59)
        expect(isDocumentExpired("2026-08-08", tardeEnElDia)).toBe(false)

        const tempranoEnElDia = new Date(2026, 7, 8, 0, 0, 1)
        expect(isDocumentExpired("2026-08-08", tempranoEnElDia)).toBe(false)
    })

    it("tolera una fecha con hora pegada", () => {
        expect(isDocumentExpired("2026-08-07T00:00:00Z", HOY)).toBe(true)
    })
})
