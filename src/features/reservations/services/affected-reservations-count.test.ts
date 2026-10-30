import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const catalog = vi.hoisted(() => ({ ids: vi.fn() }))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getReservationStatusIdsBySlug: catalog.ids },
}))

import { reservationsService } from "./reservations-service"

describe("countAffectedReservations — contrato 2026-10-27 §2.6 y §7", () => {
    const fetchMock = vi.fn()
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal("fetch", fetchMock)
        // Ids de otro ambiente a propósito: salen del catálogo por slug, nunca fijos.
        catalog.ids.mockResolvedValue({ confirmed: 27, in_progress: 28, incomplete: 912, abandoned: 911, cancelled: 29 })
    })
    afterEach(() => vi.unstubAllGlobals())

    it("cuenta confirmadas, en curso e incompletas del alojamiento, con ids separados por coma y una sola página", async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [{}], meta: { total: 12 } }), { status: 200 }))
        await expect(reservationsService.countAffectedReservations({ listingUuid: "l-1" })).resolves.toBe(12)
        const url = new URL(fetchMock.mock.calls[0][0], "http://localhost")
        expect(url.searchParams.get("listingUuid[eq]")).toBe("l-1")
        expect(url.searchParams.get("statusReservationId[in]")).toBe("27,28,912")
        expect(url.searchParams.get("per_page")).toBe("1")
    })

    it("de una propiedad, por `propertyUuid[eq]`", async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 }))
        await expect(reservationsService.countAffectedReservations({ propertyUuid: "p-1" })).resolves.toBe(0)
        expect(new URL(fetchMock.mock.calls[0][0], "http://localhost").searchParams.get("propertyUuid[eq]")).toBe("p-1")
    })

    it("si el catálogo no trae un slug, no cuenta: nunca se presenta un fallo como «0 reservas»", async () => {
        catalog.ids.mockResolvedValue({ confirmed: 27, in_progress: 28 })
        await expect(reservationsService.countAffectedReservations({ listingUuid: "l-1" })).rejects.toThrow()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("sin `meta.total` (o un 202), falla en vez de inventar un número", async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
        await expect(reservationsService.countAffectedReservations({ listingUuid: "l-1" })).rejects.toThrow()
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ message: "sync" }), { status: 202 }))
        await expect(reservationsService.countAffectedReservations({ listingUuid: "l-1" })).rejects.toThrow()
    })
})
