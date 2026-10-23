import { describe, it, expect, vi, beforeEach } from "vitest"

const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn(), get: vi.fn() }))
vi.mock("@/lib/api-client", () => ({ apiClient: api, handleSessionExpired: vi.fn() }))

import { propertyDocumentService } from "./property-document-service"

describe("propertyDocumentService — confirmación `confirmUnitOverrides` (contrato 2026-10-20)", () => {
    beforeEach(() => vi.clearAllMocks())

    it("sin confirmar, las peticiones van como siempre", async () => {
        await propertyDocumentService.update("p", "d", { content: "x" })
        await propertyDocumentService.remove("p", "d")
        expect(api.patch.mock.calls[0][1]).toEqual({ content: "x" })
        expect(api.delete.mock.calls[0][0]).toMatch(/\/properties\/p\/documents\/d$/)
    })

    it("POST, PATCH y restore la llevan en el body", async () => {
        await propertyDocumentService.create("p", { propertyDocumentTypeId: 92, statusRecordId: 6, content: "x" }, { confirmUnitOverrides: true })
        await propertyDocumentService.update("p", "d", { reservationSourceId: 21 }, { confirmUnitOverrides: true })
        await propertyDocumentService.restore("p", "d", { confirmUnitOverrides: true })
        expect(api.post.mock.calls[0][1]).toMatchObject({ confirmUnitOverrides: true })
        expect(api.patch.mock.calls[0][1]).toEqual({ reservationSourceId: 21, confirmUnitOverrides: true })
        expect(api.post.mock.calls[1][1]).toEqual({ confirmUnitOverrides: true })
    })

    it("DELETE la lleva en la URL", async () => {
        await propertyDocumentService.remove("p", "d", { confirmUnitOverrides: true })
        expect(api.delete.mock.calls[0][0]).toMatch(/\/documents\/d\?confirmUnitOverrides=1$/)
    })

    it("el texto de una unidad viaja con `listingUuid`", async () => {
        await propertyDocumentService.create("p", { propertyDocumentTypeId: 92, statusRecordId: 6, listingUuid: "unit-1", reservationSourceId: 23, content: "x" })
        expect(api.post.mock.calls[0][1]).toEqual({ propertyDocumentTypeId: 92, statusRecordId: 6, listingUuid: "unit-1", reservationSourceId: 23, content: "x" })
    })
})

describe("propertyDocumentService.list — textos de una unidad", () => {
    it("filtra con `listingUuid[eq]`; sin él pide los de la propiedad", async () => {
        // Un Response nuevo por llamada: su cuerpo solo se puede leer una vez.
        const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }))
        vi.stubGlobal("fetch", fetchMock)
        try {
            await propertyDocumentService.list("p", { propertyDocumentTypeId: 92, listingUuid: "unit-1" })
            await propertyDocumentService.list("p", { propertyDocumentTypeId: 92 })
            expect(new URL(fetchMock.mock.calls[0][0], "http://localhost").searchParams.get("listingUuid[eq]")).toBe("unit-1")
            expect(new URL(fetchMock.mock.calls[1][0], "http://localhost").searchParams.has("listingUuid[eq]")).toBe(false)
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
