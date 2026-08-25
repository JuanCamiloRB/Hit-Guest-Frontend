import { describe, expect, it } from "vitest"
import { AUTOMATION_DEFINITIONS, definitionForAutomation } from "./automation-definitions"
import type { PropertyAutomation, Provider } from "../types/automation"

function makeProvider(slug: string, signature = false): Provider {
    return {
        id: 99,
        name: slug,
        description: null,
        parameters: {
            slug,
            internalUse: { path: slug },
            billing: { billable: false, unit_cost: 0 },
            ...(signature ? {
                signature: {
                    synchronous: true,
                    contract_types: ["agreement_only" as const],
                },
            } : {}),
        },
        order: 1,
        statusProviderId: 8,
    }
}

function makeAutomation(overrides: Partial<PropertyAutomation>): PropertyAutomation {
    return {
        uuid: "automation-1",
        propertyUuid: "property-1",
        providerId: null,
        name: "Automation",
        guestType: "all",
        executionOrder: 20,
        parameters: {},
        token: null,
        statusProviderId: 10,
        deletedAt: null,
        isActive: false,
        ...overrides,
    }
}

describe("definitionForAutomation", () => {
    it("no fija IDs de providers: se resuelven desde GET /providers del país", () => {
        for (const definitionId of ["identity-verification-main", "identity-verification-secondary"]) {
            const options = AUTOMATION_DEFINITIONS.find((item) => item.id === definitionId)?.providerOptions
            expect(options).toEqual(expect.arrayContaining([
                expect.objectContaining({ value: "didit" }),
                expect.objectContaining({ value: "textract" }),
            ]))
            expect(options?.every((option) => option.providerId === undefined)).toBe(true)
        }
    })

    it("no confunde una automation no-identidad de orden bajo con identidad", () => {
        const definition = definitionForAutomation(makeAutomation({
            executionOrder: 1,
            guestType: "all",
            provider: makeProvider("future_provider"),
        }))

        expect(definition.id).toBe("automation-automation-1")
    })

    it("identifies contract routing by signature capability, regardless of order", () => {
        const definition = definitionForAutomation(makeAutomation({
            executionOrder: 11,
            providerId: 99,
            provider: makeProvider("future_signature_provider", true),
        }))

        expect(definition.id).toBe("digital-contract")
        expect(definition.order).toBe(11)
    })

    it("no pinta hitguest_signature como identidad principal aunque tenga orden bajo y main_guest", () => {
        const definition = definitionForAutomation(makeAutomation({
            executionOrder: 1,
            guestType: "main_guest",
            providerId: 99,
            provider: makeProvider("hitguest_signature", true),
        }))

        expect(definition.id).toBe("digital-contract")
        // "Contrato": la firma es un atributo del contrato, no una automatización
        // aparte. El id sigue siendo `digital-contract` porque es la llave que
        // cruza con el `automationName` del backend, no un texto de producto.
        expect(definition.title).toBe("Contrato")
    })

    it("reconoce la firma por providerSlug aunque el provider no venga sideloaded", () => {
        const definition = definitionForAutomation(makeAutomation({
            executionOrder: 1,
            guestType: "main_guest",
            provider: null,
            providerName: "hitguest_signature",
        }))

        expect(definition.id).toBe("digital-contract")
    })

    it("identifies known provider automations by slug, regardless of order", () => {
        const definition = definitionForAutomation(makeAutomation({
            executionOrder: 4,
            providerId: 99,
            provider: makeProvider("tra_colombia"),
        }))

        expect(definition.id).toBe("tra-colombia")
    })

    it("keeps unknown future providers visible as generic cards", () => {
        const definition = definitionForAutomation(makeAutomation({
            name: "Nuevo proveedor",
            providerId: 99,
            provider: makeProvider("future_provider"),
        }))

        expect(definition.id).toBe("automation-automation-1")
        expect(definition.title).toBe("Nuevo proveedor")
        expect(definition.providerOptions[0]?.value).toBe("future_provider")
    })
})
