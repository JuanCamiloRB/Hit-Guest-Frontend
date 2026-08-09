import { describe, it, expect } from "vitest"
import {
    normalizeMainGuestPrefill,
    mainGuestPrefillPatch,
    applyPrefillPatch,
} from "./main-guest-prefill"

describe("normalizeMainGuestPrefill", () => {
    it("lee los cuatro datos del titular", () => {
        expect(normalizeMainGuestPrefill({
            name: "Ricardo",
            lastname: "Lombana",
            nationalityId: 48,
            phone: "+573114720032",
            email: "ricardo@example.com",
        })).toEqual({
            name: "Ricardo",
            lastname: "Lombana",
            nationalityId: 48,
            phone: "+573114720032",
            email: "ricardo@example.com",
        })
    })

    it("acepta snake_case", () => {
        const result = normalizeMainGuestPrefill({
            first_name: "Ricardo",
            last_name: "Lombana",
            nationality_id: "48",
            guest_phone: "+573114720032",
            email_guest: "ricardo@example.com",
        })
        expect(result?.name).toBe("Ricardo")
        expect(result?.lastname).toBe("Lombana")
        expect(result?.nationalityId).toBe(48)
        expect(result?.phone).toBe("+573114720032")
        expect(result?.email).toBe("ricardo@example.com")
    })

    // La reserva guarda el nombre en UN campo libre ("Ej: María González Pérez").
    // Partirlo es indecidible en español y estos datos van a SIRE/TRA: un
    // apellido mal partido parece correcto y se envía al gobierno.
    it("descarta el nombre si no llega separado del apellido", () => {
        expect(normalizeMainGuestPrefill({ name: "María González Pérez" })).toEqual({
            name: undefined,
            lastname: undefined,
            nationalityId: undefined,
            phone: undefined,
            email: undefined,
        })
    })

    it("no precarga medio nombre aunque venga el resto de datos", () => {
        const result = normalizeMainGuestPrefill({ name: "María", email: "m@example.com" })
        expect(result?.name).toBeUndefined()
        expect(result?.lastname).toBeUndefined()
        expect(result?.email).toBe("m@example.com")
    })

    it("ignora cadenas vacías y espacios", () => {
        const result = normalizeMainGuestPrefill({ email: "   ", phone: "" })
        expect(result).toBeNull()
    })

    it("rechaza un id de país que no sea entero positivo", () => {
        expect(normalizeMainGuestPrefill({ nationalityId: 0 })).toBeNull()
        expect(normalizeMainGuestPrefill({ nationalityId: -3 })).toBeNull()
        expect(normalizeMainGuestPrefill({ nationalityId: "Colombia" })).toBeNull()
    })

    it("devuelve null cuando no hay bloque de precarga", () => {
        expect(normalizeMainGuestPrefill(undefined)).toBeNull()
        expect(normalizeMainGuestPrefill(null)).toBeNull()
        expect(normalizeMainGuestPrefill("Colombia")).toBeNull()
        expect(normalizeMainGuestPrefill({})).toBeNull()
    })
})

describe("mainGuestPrefillPatch", () => {
    const full = {
        name: "Ricardo",
        lastname: "Lombana",
        nationalityId: 48,
        phone: "+573114720032",
        email: "ricardo@example.com",
    }

    // El paso de identificación ocurre ANTES de verificar identidad: cualquiera
    // con el link llega ahí.
    it("omite contacto cuando no se pide", () => {
        expect(mainGuestPrefillPatch(full, { includeContact: false })).toEqual({
            name: "Ricardo",
            lastname: "Lombana",
            nationalityId: 48,
        })
    })

    it("incluye el correo cuando se pide", () => {
        const patch = mainGuestPrefillPatch(full, { includeContact: true })
        expect(patch.email).toBe("ricardo@example.com")
    })

    // Si el esquema no pide teléfono, el campo ni se renderiza y el formulario
    // lo limpia: precargarlo sería escribir en un campo invisible.
    it("solo precarga el teléfono si el esquema lo pide", () => {
        expect(mainGuestPrefillPatch(full, { includeContact: true }).phone).toBeUndefined()
        expect(
            mainGuestPrefillPatch(full, { includeContact: true, schemaIncludesPhone: true }).phone,
        ).toBe("+573114720032")
    })

    it("no inventa claves cuando no hay precarga", () => {
        expect(mainGuestPrefillPatch(null, { includeContact: true })).toEqual({})
        expect(mainGuestPrefillPatch(undefined, { includeContact: true })).toEqual({})
    })
})

describe("applyPrefillPatch", () => {
    it("rellena los campos vacíos", () => {
        const result = applyPrefillPatch({ name: "", email: "" }, { name: "Ricardo", email: "r@x.com" })
        expect(result).toEqual({ name: "Ricardo", email: "r@x.com" })
    })

    // Lo que el huésped ya escribió manda sobre la reserva.
    it("nunca pisa lo que el huésped ya escribió", () => {
        const result = applyPrefillPatch(
            { name: "Otro", email: "otro@x.com" },
            { name: "Ricardo", email: "r@x.com" },
        )
        expect(result).toEqual({ name: "Otro", email: "otro@x.com" })
    })

    // Un campo en su default hardcodeado no es una elección de nadie.
    it("sí sustituye un valor que sigue en su default", () => {
        const result = applyPrefillPatch(
            { nationalityId: 48 },
            { nationalityId: 170 },
            { nationalityId: 48 },
        )
        expect(result.nationalityId).toBe(170)
    })

    it("respeta un default que el huésped cambió a otra cosa", () => {
        const result = applyPrefillPatch(
            { nationalityId: 12 },
            { nationalityId: 170 },
            { nationalityId: 48 },
        )
        expect(result.nationalityId).toBe(12)
    })

    it("no toca claves ausentes del parche", () => {
        const result = applyPrefillPatch({ name: "", phone: "" }, { name: "Ricardo" })
        expect(result.phone).toBe("")
    })
})
