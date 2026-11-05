import { beforeEach, describe, expect, it } from "vitest"
import { adoptLegacyGuestFormDraft, dropLegacyGuestFormDraft, guestFormDraftKey } from "./guest-form-draft"

const LEGACY = "checkin-guest-form-r1"

describe("guest-form-draft", () => {
    beforeEach(() => localStorage.clear())

    it("la clave es por reserva Y huésped", () => {
        expect(guestFormDraftKey("r1", "g1")).toBe("checkin-guest-form-r1-g1")
        expect(guestFormDraftKey("r1", "g1")).not.toBe(guestFormDraftKey("r1", "g2"))
    })

    it("adoptar mueve el borrador viejo al titular y lo borra", () => {
        localStorage.setItem(LEGACY, JSON.stringify({ name: "Ada" }))
        expect(adoptLegacyGuestFormDraft("r1", "g1")).toEqual({ name: "Ada" })
        expect(localStorage.getItem(LEGACY)).toBeNull()
        expect(JSON.parse(localStorage.getItem("checkin-guest-form-r1-g1")!)).toEqual({ name: "Ada" })
    })

    it("si el titular ya tiene borrador propio, manda el suyo y el viejo solo se borra", () => {
        localStorage.setItem(LEGACY, JSON.stringify({ name: "Viejo" }))
        localStorage.setItem("checkin-guest-form-r1-g1", JSON.stringify({ name: "Nuevo" }))
        expect(adoptLegacyGuestFormDraft("r1", "g1")).toBeNull()
        expect(localStorage.getItem(LEGACY)).toBeNull()
        expect(JSON.parse(localStorage.getItem("checkin-guest-form-r1-g1")!)).toEqual({ name: "Nuevo" })
    })

    it("sin borrador viejo, o con uno ilegible, no hace nada que rompa", () => {
        expect(adoptLegacyGuestFormDraft("r1", "g1")).toBeNull()
        localStorage.setItem(LEGACY, "{roto")
        expect(adoptLegacyGuestFormDraft("r1", "g1")).toBeNull()
        expect(localStorage.getItem("checkin-guest-form-r1-g1")).toBeNull()
        localStorage.setItem(LEGACY, "[1]")
        expect(adoptLegacyGuestFormDraft("r1", "g1")).toBeNull()
    })

    it("drop borra solo el viejo de esa reserva", () => {
        localStorage.setItem(LEGACY, "{}")
        localStorage.setItem("checkin-guest-form-r2", "{}")
        dropLegacyGuestFormDraft("r1")
        expect(localStorage.getItem(LEGACY)).toBeNull()
        expect(localStorage.getItem("checkin-guest-form-r2")).toBe("{}")
    })
})
