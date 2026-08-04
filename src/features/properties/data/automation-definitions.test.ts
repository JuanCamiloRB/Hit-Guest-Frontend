import { describe, expect, it } from "vitest"
import { definitionForAutomation } from "./automation-definitions"
import type { PropertyAutomation, Provider } from "../types/automation"

function makeProvider(slug: string, signature = false): Provider {
    return {
        id: 99,
        name: slug,
        description: null,
        parameters: {
            slug,
            internalUse: { path: slug, tokenName: "", tokenAbilities: [] },
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
    it("identifies contract routing by signature capability, regardless of order", () => {
        const definition = definitionForAutomation(makeAutomation({
            executionOrder: 11,
            providerId: 99,
            provider: makeProvider("future_signature_provider", true),
        }))

        expect(definition.id).toBe("digital-contract")
        expect(definition.order).toBe(11)
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
