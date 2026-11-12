import { describe, expect, it } from "vitest"
import {
    credentialLabel,
    listingCredentialState,
    readCredentialsScope,
    requiredListingCredentialKeys,
    supportsListingCredentials,
} from "./credentials-scope"
import { readCredentialsComplete, readMissingCredentialKeys } from "../services/automation-service"
import type { ListingAutomationOverride } from "../types/automation"

const tra = (parameters: Record<string, unknown> | null) => ({ provider: { parameters: { slug: "tra_colombia" } }, parameters })

function override(over: Partial<ListingAutomationOverride> = {}): ListingAutomationOverride {
    return {
        uuid: "ov-1", listingUuid: "unit-1", propertyAutomationUuid: "tra-row",
        parameters: null, token: null, statusRecordId: 6, deletedAt: null, isActive: true,
        ...over,
    }
}

describe("supportsListingCredentials", () => {
    it("solo TRA y SIRE, con guion bajo o medio", () => {
        expect(supportsListingCredentials("tra_colombia")).toBe(true)
        expect(supportsListingCredentials("sire-colombia")).toBe(true)
        expect(supportsListingCredentials({ providerName: "sire_colombia" })).toBe(true)
        for (const slug of ["pdf_report", "ttlock", "didit", "", "tra"]) expect(supportsListingCredentials(slug)).toBe(false)
        expect(supportsListingCredentials(null)).toBe(false)
    })
})

describe("readCredentialsScope", () => {
    it('solo "listing" es por alojamiento', () => {
        expect(readCredentialsScope(tra({ credentials_scope: "listing" }))).toBe("listing")
    })

    it('ausente, null, "property" o desconocido → property (el modo que exige credenciales)', () => {
        for (const parameters of [null, {}, { credentials_scope: null }, { credentials_scope: "property" }, { credentials_scope: "LISTING" }, { credentials_scope: true }]) {
            expect(readCredentialsScope(tra(parameters))).toBe("property")
        }
        expect(readCredentialsScope(null)).toBe("property")
    })

    it("fuera de TRA/SIRE nunca es por alojamiento, aunque venga la clave", () => {
        expect(readCredentialsScope({ provider: { parameters: { slug: "pdf_report" } }, parameters: { credentials_scope: "listing" } })).toBe("property")
    })
})

describe("requiredListingCredentialKeys", () => {
    it("coincide con la validación del contrato §3, derivado del esquema", () => {
        expect(requiredListingCredentialKeys("tra_colombia").sort()).toEqual(["rnt", "token"])
        expect(requiredListingCredentialKeys("sire_colombia").sort()).toEqual(["document_number", "document_type", "password"])
    })

    it("company_code de SIRE es opcional y otra automatización no exige nada", () => {
        expect(requiredListingCredentialKeys("sire_colombia")).not.toContain("company_code")
        expect(requiredListingCredentialKeys("ttlock")).toEqual([])
    })

    it("la etiqueta sale del esquema; la clave cruda solo si no la conocemos", () => {
        expect(credentialLabel("tra_colombia", "rnt")).toMatch(/RNT/)
        expect(credentialLabel("tra_colombia", "otra_clave")).toBe("otra_clave")
    })
})

describe("listingCredentialState", () => {
    it("sin override: sin credenciales", () => {
        expect(listingCredentialState(null)).toEqual({ kind: "missing" })
    })

    it("apagado (7): excluido, aunque el backend diga que faltan", () => {
        expect(listingCredentialState(override({ statusRecordId: 7, isActive: false, credentialsComplete: false })))
            .toEqual({ kind: "excluded" })
    })

    it("completo según el backend: listo", () => {
        expect(listingCredentialState(override({ credentialsComplete: true, missingCredentialKeys: [] }))).toEqual({ kind: "ready" })
        expect(listingCredentialState(override({ credentialsComplete: true }))).toEqual({ kind: "ready" })
    })

    it("incompleto según el backend, con o sin las claves", () => {
        expect(listingCredentialState(override({ credentialsComplete: false, missingCredentialKeys: ["rnt"] })))
            .toEqual({ kind: "incomplete", missing: ["rnt"] })
        expect(listingCredentialState(override({ credentialsComplete: false }))).toEqual({ kind: "incomplete", missing: [] })
    })

    it("sin metadatos: no se adivina, aunque los parámetros parezcan completos o vacíos", () => {
        expect(listingCredentialState(override({ parameters: { token: "x", rnt: "1" } }))).toEqual({ kind: "unknown" })
        expect(listingCredentialState(override({ parameters: {} }))).toEqual({ kind: "unknown" })
    })

    it("metadatos contradictorios: no se elige uno", () => {
        expect(listingCredentialState(override({ credentialsComplete: true, missingCredentialKeys: ["rnt"] }))).toEqual({ kind: "unknown" })
    })
})

describe("lectura de los metadatos en el servicio", () => {
    it("acepta camelCase y snake_case", () => {
        expect(readCredentialsComplete({ credentialsComplete: false })).toBe(false)
        expect(readCredentialsComplete({ credentials_complete: true })).toBe(true)
        expect(readMissingCredentialKeys({ missingCredentialKeys: ["rnt"] })).toEqual(["rnt"])
        expect(readMissingCredentialKeys({ missing_credential_keys: ["token"] })).toEqual(["token"])
    })

    it("un tipo inesperado se lee como ausente", () => {
        for (const value of ["false", 0, null, {}]) expect(readCredentialsComplete({ credentialsComplete: value })).toBeUndefined()
        expect(readCredentialsComplete({})).toBeUndefined()
        for (const value of ["rnt", [1], [null], {}]) expect(readMissingCredentialKeys({ missingCredentialKeys: value })).toBeUndefined()
    })
})
