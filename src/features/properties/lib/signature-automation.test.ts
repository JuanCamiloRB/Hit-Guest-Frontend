import { describe, expect, it } from "vitest"
import type { PropertyAutomation, Provider } from "../types/automation"
import { buildSignatureAutomationCreatePayload, findSignatureAutomation, findSignatureProvider } from "./signature-automation"

const provider: Provider = {
    id: 7,
    name: "HIT Guest Signature",
    description: null,
    order: 10,
    statusProviderId: 8,
    parameters: {
        slug: "hitguest_signature",
        signature: { synchronous: true, contract_types: ["agreement_only"] },
        default_setup: {
            enabled: true,
            slots: [{
                name: "Digital Signature for Contract",
                order: 10,
                guest_type: "main_guest",
                status_provider_id: 8,
            }],
        },
    },
}

const automation: PropertyAutomation = {
    uuid: "automation",
    propertyUuid: "property",
    providerId: 7,
    name: "Digital Contract",
    guestType: "all",
    executionOrder: 10,
    parameters: {},
    token: null,
    statusProviderId: 8,
    deletedAt: null,
    isActive: true,
    provider: null,
    providerName: "hitguest_signature",
}

describe("signature automation resolution", () => {
    it("reconoce la fila por providerSlug aunque provider no venga sideloaded", () => {
        expect(findSignatureAutomation([automation], [provider])?.uuid).toBe("automation")
    })

    it("tolera guion y underscore al resolver el proveedor seleccionado", () => {
        expect(findSignatureProvider([provider], "hitguest-signature")?.id).toBe(7)
    })

    it("crea la fila estructural HIT Guest inactiva para configurarla después", () => {
        expect(buildSignatureAutomationCreatePayload("property", provider)).toEqual({
            propertyUuid: "property",
            providerId: 7,
            name: "Digital Signature for Contract",
            guestType: "main_guest",
            executionOrder: 10,
            parameters: {},
            statusProviderId: 10,
        })
    })

    // El backend clasifica como identidad toda fila main_guest con
    // execution_order <= 2 (o null): la fila queda indesactivable y activar su
    // provider apaga el slot Didit/Textract real. La creación NUNCA puede
    // omitir el orden ni mandar uno en ese rango.
    it("envía executionOrder aunque el provider llegue sin slots", () => {
        const bare: Provider = {
            ...provider,
            parameters: { ...provider.parameters, default_setup: undefined },
        }
        expect(buildSignatureAutomationCreatePayload("property", bare).executionOrder).toBe(10)
    })

    // El borde exacto del contrato: 2 es identidad, 3 ya no. El guard tiene que
    // reemplazar 2 y respetar 3 — un `>` o un `>=` mal puesto rompe uno de los dos.
    it.each([
        { slotOrder: 1, sent: 10 },
        { slotOrder: 2, sent: 10 },
        { slotOrder: 3, sent: 3 },
    ])("nunca envía orden en rango de identidad: slot $slotOrder → envía $sent", ({ slotOrder, sent }) => {
        const candidate: Provider = {
            ...provider,
            parameters: {
                ...provider.parameters,
                default_setup: {
                    enabled: true,
                    slots: [{
                        name: "Digital Signature for Contract",
                        order: slotOrder,
                        guest_type: "main_guest",
                        status_provider_id: 8,
                    }],
                },
            },
        }
        expect(buildSignatureAutomationCreatePayload("property", candidate).executionOrder).toBe(sent)
    })
})
