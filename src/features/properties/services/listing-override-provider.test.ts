import { afterEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/lib/api-client"
import { automationService } from "./automation-service"

afterEach(() => vi.restoreAllMocks())

/** Override de identidad del contrato 2026-10-14, en las dos convenciones. */
const CAMEL = {
    uuid: "ov-1", listingUuid: "unit-1", propertyAutomationUuid: "pa-1", statusRecordId: 6, parameters: null, token: null,
    providerId: 1004,
    effectiveProvider: { id: 1004, name: "HitGuest Essential Verification", slug: "textract", verificationType: "document_upload" },
    providerSource: "listing",
}
const SNAKE = {
    uuid: "ov-2", listing_uuid: "unit-1", property_automation_uuid: "pa-1", status_record_id: 7, parameters: null, token: null,
    provider_id: null, effective_provider: null, provider_source: null,
}

describe("automationService — override con proveedor de identidad", () => {
    it("lee providerId, effectiveProvider y providerSource en camelCase", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([CAMEL])
        const [ov] = await automationService.listListingOverrides("unit-1")
        expect(ov).toMatchObject({
            providerId: 1004,
            effectiveProvider: { id: 1004, name: "HitGuest Essential Verification", slug: "textract", verificationType: "document_upload" },
            providerSource: "listing",
            isActive: true,
        })
    })

    it("y en snake_case, distinguiendo null (no ejecuta nada) de ausente", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([SNAKE, { uuid: "ov-viejo", status_record_id: 6 }])
        const [disabled, legacy] = await automationService.listListingOverrides("unit-1")
        expect(disabled).toMatchObject({ providerId: null, effectiveProvider: null, providerSource: null, isActive: false })
        expect("providerSource" in legacy).toBe(false)
        expect(legacy.providerId).toBeNull()
    })

    it("un effectiveProvider sin id numérico no es utilizable", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([{ ...CAMEL, effectiveProvider: { id: "1004", slug: "textract" } }])
        const [ov] = await automationService.listListingOverrides("unit-1")
        expect(ov.effectiveProvider).toBeNull()
    })

    it("envía providerId al crear y al editar", async () => {
        const post = vi.spyOn(apiClient, "post").mockResolvedValue(CAMEL)
        const patch = vi.spyOn(apiClient, "patch").mockResolvedValue(CAMEL)
        await automationService.createListingOverride({ listingUuid: "unit-1", propertyAutomationUuid: "pa-1", statusRecordId: 6, providerId: 1004 })
        await automationService.updateListingOverride("ov-1", { providerId: null })
        expect(post.mock.calls[0][1]).toMatchObject({ providerId: 1004, statusRecordId: 6 })
        expect(patch.mock.calls[0][1]).toEqual({ providerId: null })
    })
})

describe("automationService — credentialsStatus (nota backend 2026-11-11)", () => {
    const STATUS = { status: "rejected", reason: "token_rejected", providerMessage: "Token inválido.", since: "2026-11-11T08:15:02-05:00" }

    it("el override lo trae en camel o snake; null es «sin pausa» y ausente es «no se sabe»", async () => {
        vi.spyOn(apiClient, "get").mockResolvedValue([
            { ...CAMEL, credentialsStatus: STATUS },
            { ...SNAKE, credentials_status: { ...STATUS, provider_message: "HTTP 401", providerMessage: undefined } },
            { ...CAMEL, uuid: "ov-3", credentialsStatus: null },
            { ...CAMEL, uuid: "ov-4" },
        ])
        const [rejected, snake, clear, unknown] = await automationService.listListingOverrides("unit-1")
        expect(rejected.credentialsStatus).toEqual(STATUS)
        expect(snake.credentialsStatus).toMatchObject({ reason: "token_rejected", providerMessage: "HTTP 401" })
        expect(clear.credentialsStatus).toBeNull()
        expect("credentialsStatus" in unknown).toBe(false)
    })

    it("la automatización de la propiedad también (lista y configure)", async () => {
        const row = { uuid: "pa-1", propertyUuid: "p", providerId: 1, name: "TRA", executionOrder: 40, parameters: {}, statusProviderId: 8 }
        vi.spyOn(apiClient, "get").mockResolvedValue([{ ...row, credentialsStatus: STATUS }, { ...row, uuid: "pa-2" }])
        const [paused, unknown] = await automationService.listGlobal({ propertyUuid: "p" })
        expect(paused.credentialsStatus).toEqual(STATUS)
        expect("credentialsStatus" in unknown).toBe(false)

        vi.spyOn(apiClient, "patch").mockResolvedValue({ ...row, credentialsStatus: null })
        const saved = await automationService.configure("pa-1", { statusProviderId: 8 })
        expect(saved.credentialsStatus).toBeNull()
    })
})
