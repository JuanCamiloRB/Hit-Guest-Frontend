import { describe, it, expect } from "vitest"
import { readGuestNameParts, composeGuestName } from "./guest-name"

describe("readGuestNameParts", () => {
    it("lee el nombre partido", () => {
        expect(readGuestNameParts({ guestName: "María", guestLastname: "González Pérez" }))
            .toEqual({ name: "María", lastname: "González Pérez" })
    })

    it("acepta snake_case", () => {
        expect(readGuestNameParts({ guest_name: "María", guest_lastname: "González" }))
            .toEqual({ name: "María", lastname: "González" })
    })

    // Reservas creadas antes de partir el campo: el nombre entero vive en
    // guest_name y no hay apellido. NO se parte por espacios — es indecidible
    // en español y el dato va a SIRE/TRA.
    it("deja intacta una reserva antigua con el nombre completo en un campo", () => {
        expect(readGuestNameParts({ guestName: "María González Pérez" }))
            .toEqual({ name: "María González Pérez", lastname: undefined })
    })

    it("ignora cadenas vacías y espacios", () => {
        expect(readGuestNameParts({ guestName: "  ", guestLastname: "" }))
            .toEqual({ name: undefined, lastname: undefined })
    })

    it("no explota con un extra ausente o raro", () => {
        expect(readGuestNameParts(undefined)).toEqual({})
        expect(readGuestNameParts(null)).toEqual({})
        expect(readGuestNameParts("María")).toEqual({})
    })
})

describe("composeGuestName", () => {
    it("une nombre y apellido", () => {
        expect(composeGuestName({ guestName: "María", guestLastname: "González" }))
            .toBe("María González")
    })

    it("devuelve el nombre completo tal cual en una reserva antigua", () => {
        expect(composeGuestName({ guestName: "María González Pérez" }))
            .toBe("María González Pérez")
    })

    it("sobrevive a que solo haya apellido", () => {
        expect(composeGuestName({ guestLastname: "González" })).toBe("González")
    })

    // undefined y no "" — quien llama decide su propio fallback.
    it("devuelve undefined cuando no hay nombre", () => {
        expect(composeGuestName({})).toBeUndefined()
        expect(composeGuestName(undefined)).toBeUndefined()
    })
})
