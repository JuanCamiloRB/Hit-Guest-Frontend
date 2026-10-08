import { describe, expect, it } from "vitest"
import { formatDeclaredAt, readPriceDeclaration } from "./guest-price-declaration"

describe("readPriceDeclaration (contrato 2026-09-27 §2.1)", () => {
    it("lee el flag y el historial tal como llegan", () => {
        const info = readPriceDeclaration({
            priceDeclaredByGuest: true,
            extra: {
                guestPriceDeclaration: {
                    amount: "850000.00",
                    currency: "COP",
                    guestUuid: "guest-1",
                    declaredAt: "2026-10-01T15:04:05+00:00",
                },
            },
        })
        expect(info.declaredByGuest).toBe(true)
        expect(info.declaration).toEqual({
            amount: 850000,
            currency: "COP",
            guestUuid: "guest-1",
            declaredAt: "2026-10-01T15:04:05+00:00",
        })
    })

    it("tras corregir el PM, el flag baja pero el historial se conserva", () => {
        const info = readPriceDeclaration({
            priceDeclaredByGuest: false,
            extra: { guest_price_declaration: { amount: 850000, currency: "COP" } },
        })
        expect(info.declaredByGuest).toBe(false)
        expect(info.declaration?.amount).toBe(850000)
        expect(info.declaration?.declaredAt).toBeNull()
    })

    it("sin clave no afirma nada: ausente ≠ declarado", () => {
        expect(readPriceDeclaration({ extra: {} })).toEqual({ declaredByGuest: false, declaration: null })
        expect(readPriceDeclaration(undefined)).toEqual({ declaredByGuest: false, declaration: null })
        expect(readPriceDeclaration({ priceDeclaredByGuest: "true" }).declaredByGuest).toBe(false)
        expect(readPriceDeclaration({ extra: { guestPriceDeclaration: { amount: "abc" } } }).declaration).toBeNull()
    })
})

describe("formatDeclaredAt", () => {
    it("formatea el ISO con zona y no revienta con basura", () => {
        expect(formatDeclaredAt("2026-10-01T15:04:05+00:00")).toMatch(/2026/)
        expect(formatDeclaredAt("no-es-fecha")).toBeNull()
        expect(formatDeclaredAt(null)).toBeNull()
    })
})
