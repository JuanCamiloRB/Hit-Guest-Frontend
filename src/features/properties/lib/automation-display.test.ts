import { describe, it, expect } from "vitest"
import { automationDisplay, automationTitle } from "./automation-display"
import { AUTOMATION_STATUS, type ListingAutomationOverride, type PropertyAutomation, type Provider } from "../types/automation"

function provider(slug: string, name = slug, extra: Record<string, unknown> = {}): Provider {
    return { id: 1, name, description: null, order: 0, statusProviderId: 8, parameters: { slug, ...extra } } as Provider
}

function row(slug: string, over: Partial<PropertyAutomation> = {}): PropertyAutomation {
    return {
        uuid: `row-${slug}`, propertyUuid: "p-1", providerId: 1, name: "Backend name in English",
        guestType: "main_guest", executionOrder: 1, parameters: {}, token: null,
        statusProviderId: AUTOMATION_STATUS.ACTIVE, deletedAt: null, isActive: true,
        providerName: slug, provider: provider(slug), ...over,
    }
}

describe("automationDisplay — lo que ve el PM, nunca el slug (2026-10-27)", () => {
    it("el detalle es el nombre del proveedor en la DB (Ricardo, 2026-10-29); el slug no sale", () => {
        const didit = row("didit", { provider: provider("didit", "Advanced Verification", { verification_type: "session" }) })
        expect(automationDisplay(didit)).toEqual({
            title: "Verificación de Identidad (Principal)", detail: "Advanced Verification", channels: null,
        })
    })

    describe("con override de la unidad: el proveedor que REALMENTE ejecuta", () => {
        const didit = row("didit", { provider: provider("didit", "Advanced Verification", { verification_type: "session" }) })
        const withEffective = (effectiveProvider: unknown) =>
            ({ isActive: true, parameters: null, effectiveProvider }) as unknown as ListingAutomationOverride

        it("la unidad eligió Esencial: el badge no dice «Avanzada»", () => {
            const override = withEffective({ id: 2, name: "Essential Verification", slug: "textract", verificationType: "document_upload" })
            expect(automationDisplay(didit, override).detail).toBe("Essential Verification")
        })

        it("sin nombre del backend, «Proveedor configurado»: el front no traduce (Ricardo, 2026-10-30)", () => {
            const override = withEffective({ id: 2, name: null, slug: "textract", verificationType: "document_upload" })
            expect(automationDisplay(didit, override).detail).toBe("Proveedor configurado")
        })

        it("la unidad no ejecuta nada: sin badge", () => {
            expect(automationDisplay(didit, withEffective(null)).detail).toBeNull()
        })

        it("un override sin `effectiveProvider` (backend anterior) muestra el de la propiedad", () => {
            const legacy = { isActive: true, parameters: null } as unknown as ListingAutomationOverride
            expect(automationDisplay(didit, legacy).detail).toBe("Advanced Verification")
        })
    })

    it("contrato: «Contrato», no «Digital Signature for Contract», con el nombre del proveedor", () => {
        const signature = row("hitguest_signature", {
            name: "Digital Signature for Contract",
            provider: provider("hitguest_signature", "Firma nativa HIT Guest", { signature: { synchronous: true, contract_types: ["agreement_only"] } }),
        })
        expect(automationDisplay(signature)).toMatchObject({ title: "Contrato", detail: "Firma nativa HIT Guest" })
    })

    it("sin el provider en la respuesta: «Proveedor configurado», nunca el slug ni una etiqueta del front", () => {
        const bare = row("didit", { provider: null })
        expect(automationDisplay(bare).detail).toBe("Proveedor configurado")
    })

    it("un `name` igual al slug no cuenta como nombre legible", () => {
        expect(automationDisplay(row("textract")).detail).toBe("Proveedor configurado")
    })

    describe("envío del link: el proveedor en el badge Y sus canales efectivos aparte", () => {
        const delivery = row("whatsapp_checkin_link", {
            name: "Check-in Link Delivery", automationType: "checkin_link_delivery",
            parameters: { channels: ["email", "whatsapp"] },
            provider: provider("whatsapp_checkin_link", "WhatsApp"),
        })

        it("los de la propiedad", () => {
            expect(automationDisplay(delivery)).toEqual({ title: "Envío del link de check-in", detail: "WhatsApp", channels: "Email y WhatsApp" })
        })

        it("los de la unidad, si su override los cambia", () => {
            const override = { isActive: true, parameters: { channels: ["email"] } } as unknown as ListingAutomationOverride
            expect(automationDisplay(delivery, override).channels).toBe("Solo email")
        })
    })

    it("proveedor desconocido sin nombre legible: «Proveedor configurado»; nunca el slug", () => {
        expect(automationDisplay(row("proveedor_nuevo", { provider: provider("proveedor_nuevo", "Nuevo Proveedor") })).detail).toBe("Nuevo Proveedor")
        expect(automationDisplay(row("proveedor_nuevo")).detail).toBe("Proveedor configurado")
        expect(Object.values(automationDisplay(row("proveedor_nuevo")))).not.toContain("proveedor_nuevo")
    })

    it("automationTitle sirve para títulos sueltos (modal de override)", () => {
        expect(automationTitle(row("didit", { provider: provider("didit", "Didit", { verification_type: "session" }) }))).toBe("Verificación de Identidad (Principal)")
    })
})
