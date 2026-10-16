import { describe, expect, it } from "vitest"
import {
    IdentityProviderUnavailableError,
    draftIdentityOverride,
    identityOverrideSummary,
    inheritDescription,
    isIdentityPropertyAutomation,
    planIdentityOverrideWrite,
    propertySlotCanBeOverridden,
    readIdentityOverrideState,
} from "./identity-listing-override"
import { resolveIdentityProviders, identityLevelOfProvider } from "./identity-providers"
import type { ListingAutomationOverride, Provider } from "../types/automation"

const provider = (id: number, slug: string, verification_type?: string): Provider => ({
    id, name: slug, description: null, order: 0, statusProviderId: 8,
    parameters: { slug, ...(verification_type ? { verification_type } : {}) },
})
const ADVANCED = provider(501, "didit", "session")
const ESSENTIAL = provider(502, "textract", "document_upload")
const CATALOG = resolveIdentityProviders([provider(1, "tra_colombia"), ADVANCED, ESSENTIAL])
const SLOT = { isActive: true, statusProviderId: 8, providerId: 501, provider: ADVANCED, automationType: "identity_verification" as const }

const ov = (over: Partial<ListingAutomationOverride> = {}): ListingAutomationOverride => ({
    uuid: "ov-1", listingUuid: "unit-1", propertyAutomationUuid: "pa-1", parameters: null, token: null,
    statusRecordId: 6, deletedAt: null, isActive: true, ...over,
})
const TARGET = { listingUuid: "unit-1", propertyAutomationUuid: "pa-1", catalog: CATALOG }

describe("identity-providers — niveles por verification_type, nunca por id", () => {
    it("session = Avanzada, document_upload = Esencial; el slug solo como respaldo", () => {
        expect(identityLevelOfProvider(ADVANCED)).toBe("advanced")
        expect(identityLevelOfProvider(provider(9, "otro", "document_upload"))).toBe("essential")
        expect(identityLevelOfProvider(provider(9, "textract"))).toBe("essential")
        expect(identityLevelOfProvider(provider(9, "tra_colombia"))).toBeNull()
    })

    it("lo que no está en el catálogo queda en null", () => {
        expect(resolveIdentityProviders([ADVANCED])).toEqual({ advanced: ADVANCED, essential: null })
    })
})

describe("readIdentityOverrideState — tabla de la sección 3 del contrato", () => {
    it.each([
        ["sin override", null, "inherit", false],
        ["6 + property", ov({ providerSource: "property" }), "inherit", false],
        ["6 + listing + session", ov({ providerSource: "listing", providerId: 501, effectiveProvider: { id: 501, name: null, slug: "didit", verificationType: "session" } }), "advanced", false],
        ["6 + listing + document_upload", ov({ providerSource: "listing", providerId: 502, effectiveProvider: { id: 502, name: null, slug: "textract", verificationType: "document_upload" } }), "essential", false],
        ["7", ov({ statusRecordId: 7, isActive: false, providerSource: null }), "disabled", false],
        ["6 + null (propiedad apagada)", ov({ providerSource: null }), "inherit", true],
    ] as const)("%s", (_case, override, choice, withoutVerification) => {
        expect(readIdentityOverrideState(override, CATALOG)).toEqual({ choice, inheritsWithoutVerification: withoutVerification })
    })

    it("sin effectiveProvider, el nivel se resuelve por el id contra el catálogo", () => {
        expect(readIdentityOverrideState(ov({ providerSource: "listing", providerId: 502 }), CATALOG).choice).toBe("essential")
    })

    it("backend anterior (sin providerSource): un 6 se lee como herencia", () => {
        expect(readIdentityOverrideState(ov(), CATALOG).choice).toBe("inherit")
    })
})

describe("planIdentityOverrideWrite — matriz de escritura", () => {
    const essentialOwn = ov({ providerSource: "listing", providerId: 502 })

    it("Heredar: nada sin override, DELETE con override", () => {
        expect(planIdentityOverrideWrite({ ...TARGET, current: null, choice: "inherit" })).toEqual([])
        expect(planIdentityOverrideWrite({ ...TARGET, current: essentialOwn, choice: "inherit" })).toEqual([{ kind: "delete", uuid: "ov-1" }])
    })

    it("Avanzada/Esencial: POST sin override, PATCH {providerId} con override activo", () => {
        expect(planIdentityOverrideWrite({ ...TARGET, current: null, choice: "essential" })).toEqual([
            { kind: "create", payload: { listingUuid: "unit-1", propertyAutomationUuid: "pa-1", statusRecordId: 6, providerId: 502 } },
        ])
        expect(planIdentityOverrideWrite({ ...TARGET, current: essentialOwn, choice: "advanced" })).toEqual([
            { kind: "update", uuid: "ov-1", payload: { providerId: 501 } },
        ])
        expect(planIdentityOverrideWrite({ ...TARGET, current: ov({ providerSource: "property" }), choice: "advanced" })).toEqual([
            { kind: "update", uuid: "ov-1", payload: { providerId: 501 } },
        ])
    })

    it("la misma elección propia no llama a nada", () => {
        expect(planIdentityOverrideWrite({ ...TARGET, current: essentialOwn, choice: "essential" })).toEqual([])
    })

    it("Desactivado → proveedor: DELETE + POST, nunca 6 + providerId sobre un 7", () => {
        const disabled = ov({ statusRecordId: 7, isActive: false })
        expect(planIdentityOverrideWrite({ ...TARGET, current: disabled, choice: "advanced" })).toEqual([
            { kind: "delete", uuid: "ov-1" },
            { kind: "create", payload: { listingUuid: "unit-1", propertyAutomationUuid: "pa-1", statusRecordId: 6, providerId: 501 } },
        ])
    })

    it("Desactivar: POST 7 o PATCH 7, siempre SIN providerId", () => {
        expect(planIdentityOverrideWrite({ ...TARGET, current: null, choice: "disabled" })).toEqual([
            { kind: "create", payload: { listingUuid: "unit-1", propertyAutomationUuid: "pa-1", statusRecordId: 7 } },
        ])
        expect(planIdentityOverrideWrite({ ...TARGET, current: essentialOwn, choice: "disabled" })).toEqual([
            { kind: "update", uuid: "ov-1", payload: { statusRecordId: 7 } },
        ])
        expect(planIdentityOverrideWrite({ ...TARGET, current: ov({ statusRecordId: 7, isActive: false }), choice: "disabled" })).toEqual([])
    })

    it("sin el nivel en el catálogo no inventa un id", () => {
        expect(() => planIdentityOverrideWrite({ ...TARGET, catalog: { advanced: ADVANCED, essential: null }, current: null, choice: "essential" }))
            .toThrow(IdentityProviderUnavailableError)
    })
})

describe("slot de la propiedad", () => {
    it("identidad por automationType o por proveedor", () => {
        expect(isIdentityPropertyAutomation({ automationType: "identity_verification" })).toBe(true)
        expect(isIdentityPropertyAutomation({ provider: ESSENTIAL })).toBe(true)
        expect(isIdentityPropertyAutomation({ providerName: "didit" })).toBe(true)
        expect(isIdentityPropertyAutomation({ providerName: "tra_colombia" })).toBe(false)
    })

    it("solo un slot activo y con proveedor se puede cambiar por unidad", () => {
        expect(propertySlotCanBeOverridden(SLOT)).toBe(true)
        expect(propertySlotCanBeOverridden({ ...SLOT, isActive: false, statusProviderId: 10 })).toBe(false)
        expect(propertySlotCanBeOverridden({ ...SLOT, providerId: null })).toBe(false)
    })

    it("Heredar dice qué usa la propiedad, o que no verifica", () => {
        expect(inheritDescription(SLOT)).toMatch(/verificación avanzada/)
        expect(inheritDescription({ ...SLOT, isActive: false, statusProviderId: 10 })).toMatch(/solo suben fotos/)
    })
})

describe("identityOverrideSummary y borradores", () => {
    it("resume cada estado para las listas", () => {
        expect(identityOverrideSummary(null, SLOT, CATALOG)).toEqual({ label: "Hereda de la propiedad (verificación avanzada)", tone: "inherit" })
        expect(identityOverrideSummary(ov({ providerSource: "listing", providerId: 502 }), SLOT, CATALOG).label).toBe("Verificación esencial en esta unidad")
        expect(identityOverrideSummary(ov({ statusRecordId: 7, isActive: false }), SLOT, CATALOG).tone).toBe("disabled")
        expect(identityOverrideSummary(ov({ providerSource: null }), SLOT, CATALOG).label).toBe("Hereda de la propiedad (sin verificación)")
    })

    it("un borrador guarda el proveedor elegido; heredar no deja nada", () => {
        expect(draftIdentityOverride({ ...TARGET, choice: "essential" })).toMatchObject({
            statusRecordId: 6, providerId: 502, providerSource: "listing", effectiveProvider: { id: 502, verificationType: "document_upload" },
        })
        expect(draftIdentityOverride({ ...TARGET, choice: "disabled" })).toMatchObject({ statusRecordId: 7, providerId: null })
        expect(draftIdentityOverride({ ...TARGET, choice: "inherit" })).toBeNull()
    })
})
