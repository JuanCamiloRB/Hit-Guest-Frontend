import { describe, expect, it } from "vitest"
import { isSupportAgentOnly, readSupportFlags } from "./support-access"
import { initialsOf } from "./support-display"

describe("readSupportFlags — solo un true explícito habilita", () => {
    it("lee los dos booleanos del contrato", () => {
        expect(readSupportFlags({ canAccessSupportConsole: true, canManageSupportAgents: true }))
            .toEqual({ canAccessSupportConsole: true, canManageSupportAgents: true })
    })

    it("ausentes, nulos o con otro tipo son «no» (backend que todavía no los emite)", () => {
        expect(readSupportFlags({})).toEqual({ canAccessSupportConsole: false, canManageSupportAgents: false })
        expect(readSupportFlags(null)).toEqual({ canAccessSupportConsole: false, canManageSupportAgents: false })
        expect(readSupportFlags({ canAccessSupportConsole: "true", canManageSupportAgents: 1 }))
            .toEqual({ canAccessSupportConsole: false, canManageSupportAgents: false })
    })
})

describe("isSupportAgentOnly", () => {
    it("support_agent: consola sí, agentes no", () => {
        expect(isSupportAgentOnly({ canAccessSupportConsole: true, canManageSupportAgents: false })).toBe(true)
    })

    it("super_admin no es «solo agente», y un PM tampoco", () => {
        expect(isSupportAgentOnly({ canAccessSupportConsole: true, canManageSupportAgents: true })).toBe(false)
        expect(isSupportAgentOnly({ canAccessSupportConsole: false })).toBe(false)
        expect(isSupportAgentOnly(null)).toBe(false)
    })
})


describe("initialsOf", () => {
    it("toma la primera letra de las dos primeras palabras con letras", () => {
        expect(initialsOf("Casa Rentals252a2")).toBe("CR")
        expect(initialsOf("HiTGuest -")).toBe("H")
        expect(initialsOf("(Juan) Pérez")).toBe("JP")
        expect(initialsOf("  ")).toBe("?")
    })
})
