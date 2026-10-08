import { describe, expect, it } from "vitest"
import type { ListingAutomationOverride, PropertyAutomation, Provider } from "../types/automation"
import {
    buildChannels,
    buildCheckinLinkDeliveryCreatePayload,
    describeChannelCost,
    describeChannels,
    describeResendCharges,
    isChargedCost,
    isCheckinLinkDeliveryAutomation,
    isEmailFallback,
    nextExecutionOrder,
    optionalChannelsOf,
    partitionCheckinLinkDelivery,
    providerUnitCost,
    readChannelErrors,
    readDeliveryChannels,
    readOverrideSelection,
    resolveEffectiveChannels,
    sameOverrideSelection,
} from "./checkin-link-delivery"

const whatsappProvider: Provider = {
    id: 42,
    name: "WhatsApp Check-in Link",
    description: null,
    order: 7,
    statusProviderId: 8,
    parameters: {
        slug: "whatsapp_checkin_link",
        billing: { billable: true, unit_cost: 0 },
    },
}

const otaProvider: Provider = {
    id: 43,
    name: "OTA Inbox Check-in Link",
    description: null,
    automationType: null,
    order: 8,
    statusProviderId: 8,
    parameters: {
        slug: "ota_inbox_checkin_link",
        billing: { billable: true, unit_cost: 0.0625 },
    },
}

const traProvider: Provider = {
    id: 1,
    name: "TRA",
    description: null,
    order: 40,
    statusProviderId: 8,
    parameters: { slug: "tra_colombia" },
}

function makeAutomation(overrides: Partial<PropertyAutomation> = {}): PropertyAutomation {
    return {
        uuid: "delivery",
        propertyUuid: "property",
        providerId: 42,
        name: "Check-in Link Delivery",
        guestType: "all",
        executionOrder: 7,
        parameters: { channels: ["email", "whatsapp"] },
        token: null,
        statusProviderId: 8,
        deletedAt: null,
        isActive: true,
        provider: null,
        providerName: "whatsapp_checkin_link",
        ...overrides,
    }
}

function makeOverride(overrides: Partial<ListingAutomationOverride> = {}): ListingAutomationOverride {
    return {
        uuid: "override",
        listingUuid: "listing",
        propertyAutomationUuid: "delivery",
        parameters: { channels: ["email"] },
        token: null,
        statusRecordId: 6,
        deletedAt: null,
        isActive: true,
        ...overrides,
    }
}

describe("readDeliveryChannels", () => {
    it("acepta los tres canales del contrato, sin duplicados y en orden de presentación", () => {
        expect(readDeliveryChannels({ channels: ["ota_inbox", "email", "telegram", "whatsapp", "email"] }))
            .toEqual(["email", "whatsapp", "ota_inbox"])
    })

    it("devuelve vacío si la clave falta o no es lista", () => {
        expect(readDeliveryChannels({})).toEqual([])
        expect(readDeliveryChannels({ channels: "email" })).toEqual([])
        expect(readDeliveryChannels(null)).toEqual([])
    })
})

describe("resolveEffectiveChannels — tabla de verdad §2", () => {
    it("sin automatización → email", () => {
        expect(resolveEffectiveChannels({ automation: null })).toEqual(["email"])
    })

    it("automatización activa → lo que diga channels, OTA incluido", () => {
        expect(resolveEffectiveChannels({ automation: makeAutomation() })).toEqual(["email", "whatsapp"])
        expect(resolveEffectiveChannels({ automation: makeAutomation({ parameters: { channels: ["email", "ota_inbox"] } }) }))
            .toEqual(["email", "ota_inbox"])
    })

    it("automatización inactiva → email aunque tenga otros canales guardados", () => {
        expect(resolveEffectiveChannels({
            automation: makeAutomation({ statusProviderId: 10, isActive: false }),
        })).toEqual(["email"])
    })

    it("override activo gana y reemplaza la lista entera", () => {
        expect(resolveEffectiveChannels({
            automation: makeAutomation(),
            override: makeOverride({ parameters: { channels: ["email"] } }),
        })).toEqual(["email"])
    })

    it("override inactivo → email", () => {
        expect(resolveEffectiveChannels({
            automation: makeAutomation(),
            override: makeOverride({ statusRecordId: 7, isActive: false, parameters: { channels: ["email", "whatsapp"] } }),
        })).toEqual(["email"])
    })

    it("channels vacío o desconocido nunca deja la lista vacía", () => {
        expect(resolveEffectiveChannels({ automation: makeAutomation({ parameters: { channels: [] } }) }))
            .toEqual(["email"])
        expect(resolveEffectiveChannels({ automation: makeAutomation({ parameters: { channels: ["telegram"] } }) }))
            .toEqual(["email"])
    })
})

describe("identificación de la fila y partición del catálogo", () => {
    it("detecta la fila por automationType aunque el slug no coincida (checklist §11)", () => {
        expect(isCheckinLinkDeliveryAutomation(makeAutomation({
            automationType: "checkin_link_delivery",
            providerName: "otro_slug",
        }))).toBe(true)
        expect(isCheckinLinkDeliveryAutomation(makeAutomation({ providerName: "tra_colombia" }))).toBe(false)
    })

    it("sin automationType cae al slug del provider", () => {
        expect(isCheckinLinkDeliveryAutomation(makeAutomation())).toBe(true)
    })

    it("separa la fila y saca del catálogo genérico los providers de WhatsApp y de OTA", () => {
        const tra = makeAutomation({ uuid: "tra", providerName: "tra-colombia" })
        const result = partitionCheckinLinkDelivery([tra, makeAutomation()], [traProvider, whatsappProvider, otaProvider])
        expect(result.automation?.uuid).toBe("delivery")
        expect(result.rest.automations.map((a) => a.uuid)).toEqual(["tra"])
        expect(result.rest.providers.map((p) => p.id)).toEqual([1])
    })
})

describe("selección de canales (email fijo)", () => {
    it("el email va siempre; los opcionales se agregan en orden", () => {
        expect(buildChannels([])).toEqual(["email"])
        expect(buildChannels(["ota_inbox", "whatsapp"])).toEqual(["email", "whatsapp", "ota_inbox"])
        expect([...optionalChannelsOf(["email", "ota_inbox"])]).toEqual(["ota_inbox"])
    })

    it("describe cualquier combinación", () => {
        expect(describeChannels(["email"])).toBe("Solo email")
        expect(describeChannels(["email", "whatsapp"])).toBe("Email y WhatsApp")
        expect(describeChannels(["email", "whatsapp", "ota_inbox"])).toBe("Email, WhatsApp y mensaje en la OTA")
        expect(describeChannels(["whatsapp"])).toBe("Solo WhatsApp")
    })

    it("el email es respaldo solo si no está entre los canales resueltos (§13.7)", () => {
        expect(isEmailFallback(["ota_inbox"])).toBe(true)
        expect(isEmailFallback(["email", "whatsapp"])).toBe(false)
    })
})

describe("tarifas — siempre del provider de cada canal", () => {
    it("lee el unit_cost y no inventa uno", () => {
        expect(providerUnitCost(whatsappProvider)).toBe(0)
        expect(providerUnitCost(otaProvider)).toBe(0.0625)
        expect(providerUnitCost(traProvider)).toBeNull()
        expect(providerUnitCost(null)).toBeNull()
    })

    it("0 se dice «sin costo por ahora»; sin tarifa, «puede generar costo»", () => {
        expect(describeChannelCost(0)).toBe("Sin costo por ahora")
        expect(describeChannelCost(null)).toBe("Puede generar costo")
        // Cuatro decimales: redondear 0.0625 a «0,06» subestima la tarifa un 4 %.
        expect(describeChannelCost(0.0625)).toBe("0,0625 USD por mensaje")
        expect(isChargedCost(0.0625)).toBe(true)
        expect(isChargedCost(0)).toBe(false)
        expect(isChargedCost(null)).toBe(false)
    })
})

describe("describeResendCharges (§8 + §13.8)", () => {
    const costs = { whatsapp: 0, ota_inbox: 0.0625 }

    it("solo email: no hay nada que advertir", () => {
        expect(describeResendCharges({ channels: ["email"], whatsappUsable: true, otaApplicable: true, unitCosts: costs })).toBeNull()
    })

    it("lista los canales que se intentan, con la certeza de cada tarifa", () => {
        const text = describeResendCharges({
            channels: ["email", "whatsapp", "ota_inbox"],
            whatsappUsable: true,
            otaApplicable: true,
            unitCosts: costs,
        })!
        expect(text).toContain("También saldrá por WhatsApp y mensaje en la OTA")
        expect(text).toContain("WhatsApp hoy no tiene costo")
        expect(text).toContain("Mensaje en la OTA cuesta 0,0625 USD")
    })

    it("un canal que no aplica se explica y no se cobra", () => {
        const text = describeResendCharges({
            channels: ["email", "whatsapp", "ota_inbox"],
            whatsappUsable: false,
            otaApplicable: false,
            unitCosts: costs,
        })!
        expect(text).not.toContain("También saldrá")
        expect(text).toContain("WhatsApp no aplica")
        expect(text).toContain("El mensaje en la OTA no aplica")
    })

    it("sin saber el origen, la OTA se anuncia condicionada: ni envío seguro ni cobro afirmado", () => {
        const text = describeResendCharges({
            channels: ["email", "ota_inbox"],
            whatsappUsable: false,
            otaApplicable: null,
            unitCosts: { whatsapp: null, ota_inbox: null },
        })!
        expect(text).toContain("solo si la reserva lo permite")
        expect(text).toContain("si sale, puede generar costo")
        expect(text).not.toContain("También saldrá")
        expect(text).not.toContain("no aplica")
    })

    it("con origen desconocido y tarifa conocida, el costo también va condicionado", () => {
        const text = describeResendCharges({
            channels: ["email", "ota_inbox"],
            whatsappUsable: false,
            otaApplicable: null,
            unitCosts: costs,
        })!
        expect(text).toContain("si sale, cuesta 0,0625 USD")
        expect(text).not.toContain("También saldrá")
    })
})

describe("override por unidad: heredar o conjunto propio", () => {
    it("lee la selección desde el override", () => {
        expect(readOverrideSelection(null)).toEqual({ kind: "inherit" })
        expect(readOverrideSelection(makeOverride({ parameters: { channels: ["email", "ota_inbox"] } })))
            .toEqual({ kind: "custom", channels: ["email", "ota_inbox"] })
        // Un override inactivo equivale a «solo email» (§3.5).
        expect(readOverrideSelection(makeOverride({ statusRecordId: 7, isActive: false })))
            .toEqual({ kind: "custom", channels: ["email"] })
    })

    it("compara selecciones por conjunto, sin importar el orden", () => {
        expect(sameOverrideSelection({ kind: "inherit" }, { kind: "inherit" })).toBe(true)
        expect(sameOverrideSelection(
            { kind: "custom", channels: ["email", "ota_inbox", "whatsapp"] },
            { kind: "custom", channels: ["email", "whatsapp", "ota_inbox"] },
        )).toBe(true)
        expect(sameOverrideSelection({ kind: "inherit" }, { kind: "custom", channels: ["email"] })).toBe(false)
    })
})

describe("readChannelErrors — 422 de canales (§3.4, §13.3, §13.4)", () => {
    it("toma los mensajes de parameters.channels y parameters.channels.N, tal cual", () => {
        expect(readChannelErrors({
            "parameters.channels": ["El canal de mensaje de OTA requiere que la propiedad esté conectada a KunasPMS o Calry."],
            "parameters.channels.1": ["\"telegram\" no es un canal de envío."],
            "parameters.triggerTypes": ["otro error"],
        })).toEqual([
            "El canal de mensaje de OTA requiere que la propiedad esté conectada a KunasPMS o Calry.",
            "\"telegram\" no es un canal de envío.",
        ])
    })

    it("sin errores de canales devuelve vacío", () => {
        expect(readChannelErrors(undefined)).toEqual([])
        expect(readChannelErrors(["mensaje suelto"])).toEqual([])
        expect(readChannelErrors({ name: ["requerido"] })).toEqual([])
    })
})

describe("buildCheckinLinkDeliveryCreatePayload", () => {
    it("nace inactiva, vacía y con orden fuera del rango de identidad", () => {
        const existing = [makeAutomation({ uuid: "a", executionOrder: 1 }), makeAutomation({ uuid: "b", executionOrder: 10 })]
        const payload = buildCheckinLinkDeliveryCreatePayload("property", whatsappProvider, existing)
        expect(payload).toEqual({
            propertyUuid: "property",
            providerId: 42,
            name: "Check-in Link Delivery",
            guestType: "all",
            executionOrder: 11,
            parameters: {},
            statusProviderId: 10,
        })
    })

    it("usa el slot del provider cuando lo declara", () => {
        const withSlot: Provider = {
            ...whatsappProvider,
            parameters: {
                ...whatsappProvider.parameters,
                default_setup: {
                    enabled: true,
                    slots: [{ name: "Envío del link", order: 60, guest_type: "all", status_provider_id: 10 }],
                },
            },
        }
        const payload = buildCheckinLinkDeliveryCreatePayload("property", withSlot, [])
        expect(payload.name).toBe("Envío del link")
        expect(payload.executionOrder).toBe(60)
    })

    it("nunca manda un orden en rango de identidad", () => {
        expect(nextExecutionOrder([])).toBe(3)
        expect(nextExecutionOrder([makeAutomation({ executionOrder: 2 })])).toBe(3)
    })

    it("rechaza un provider que no es el de WhatsApp", () => {
        expect(() => buildCheckinLinkDeliveryCreatePayload("property", traProvider, [])).toThrow()
    })
})
