import { describe, it, expect, vi, beforeEach } from "vitest"

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/lib/api-client", () => ({ apiClient: api, handleSessionExpired: vi.fn() }))

import { automationService } from "../services/automation-service"
import { automationDisplay } from "./automation-display"
import { AUTOMATION_STATUS, type PropertyAutomation, type Provider } from "../types/automation"

/**
 * API → `normalizeOverride` → `automationDisplay`, sin atajos: las pruebas
 * sueltas de cada pieza pasaban mientras su composición borraba el badge de
 * cualquier fila con override (auditoría 2026-10-29).
 */

function provider(slug: string, name: string, extra: Record<string, unknown> = {}): Provider {
    return { id: 1, name, description: null, order: 0, statusProviderId: 8, parameters: { slug, ...extra } } as Provider
}

const IDENTITY: PropertyAutomation = {
    uuid: "identity-row", propertyUuid: "p-1", providerId: 1, name: "Identity Verification - Main Guest",
    guestType: "main_guest", executionOrder: 1, parameters: {}, token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE, deletedAt: null, isActive: true, providerName: "didit",
    automationType: "identity_verification",
    provider: provider("didit", "Advanced Verification", { verification_type: "session" }),
}

const PDF: PropertyAutomation = {
    ...IDENTITY, uuid: "pdf-row", name: "Guest Report PDF", guestType: "all", executionOrder: 30,
    providerName: "pdf_report", automationType: undefined, provider: provider("pdf_report", "Reporte PDF de huéspedes"),
}

async function overrideFromApi(raw: Record<string, unknown>) {
    api.get.mockResolvedValue({ data: [{ uuid: "ov-1", statusRecordId: 6, parameters: null, token: null, ...raw }] })
    const [override] = await automationService.listListingOverrides("unit-1")
    return override
}

describe("badge del proveedor con overrides reales de la API", () => {
    beforeEach(() => vi.clearAllMocks())

    it("override SIN `effectiveProvider` (backend anterior): conserva el proveedor de la propiedad", async () => {
        const override = await overrideFromApi({ propertyAutomationUuid: "identity-row" })
        expect(override.effectiveProvider).toBeUndefined()
        expect(automationDisplay(IDENTITY, override).detail).toBe("Advanced Verification")
    })

    it("override no-identidad con parámetros propios: conserva provider.name", async () => {
        const override = await overrideFromApi({ propertyAutomationUuid: "pdf-row", parameters: { recipients: ["a@b.co"] }, effectiveProvider: null })
        expect(automationDisplay(PDF, override).detail).toBe("Reporte PDF de huéspedes")
    })

    it("identidad con `effectiveProvider: null` explícito: sin badge", async () => {
        const override = await overrideFromApi({ propertyAutomationUuid: "identity-row", statusRecordId: 7, effectiveProvider: null, providerSource: null })
        expect(override.effectiveProvider).toBeNull()
        expect(automationDisplay(IDENTITY, override).detail).toBeNull()
    })

    it("identidad con proveedor propio: el nombre efectivo, no el de la propiedad", async () => {
        const override = await overrideFromApi({
            propertyAutomationUuid: "identity-row",
            providerId: 2,
            effectiveProvider: { id: 2, name: "Essential Verification", slug: "textract", verificationType: "document_upload" },
            providerSource: "listing",
        })
        expect(automationDisplay(IDENTITY, override).detail).toBe("Essential Verification")
    })

    it("también lee la forma snake_case", async () => {
        const override = await overrideFromApi({
            property_automation_uuid: "identity-row",
            effective_provider: { id: 2, name: "Essential Verification", slug: "textract" },
        })
        expect(automationDisplay(IDENTITY, override).detail).toBe("Essential Verification")
    })
})
