import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/auth/store/auth-store", () => ({
    useAuthStore: { getState: () => ({ user: { token: "t" } }) },
}))

import { ReservationsNotReadyError, reservationsService } from "./reservations-service"

function pageResponse(items: unknown[], lastPage: number) {
    return new Response(JSON.stringify({ data: items, meta: { last_page: lastPage } }), { status: 200 })
}

describe("GET /reservations → 202 («todavía no»)", () => {
    const fetchMock = vi.fn()
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal("fetch", fetchMock)
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(console, "info").mockImplementation(() => {})
    })
    afterEach(() => vi.unstubAllGlobals())

    it("un 202 en una página posterior lanza ReservationsNotReadyError con esa página y SIN console.error", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            const page = Number(new URL(url, "http://localhost").searchParams.get("page"))
            if (page === 3) return new Response(JSON.stringify({ message: "sincronizando" }), { status: 202 })
            return pageResponse([{ uuid: `r-${page}` }], 4)
        })
        const settled = reservationsService.list().catch((error: unknown) => error)
        const error = await settled
        expect(error).toBeInstanceOf(ReservationsNotReadyError)
        expect((error as ReservationsNotReadyError).page).toBe(3)
        expect((error as Error).message).toBe("reservations_not_ready (page 3)")
        expect(console.error).not.toHaveBeenCalled()
    })

    it("un 202 en la primera página también lleva su página", async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({}), { status: 202 }))
        const error = await reservationsService.list().catch((e: unknown) => e)
        expect((error as ReservationsNotReadyError).page).toBe(1)
        expect(console.error).not.toHaveBeenCalled()
    })

    it("un fallo de verdad (500) sí se registra como error", async () => {
        fetchMock.mockImplementation(async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 }))
        await expect(reservationsService.list()).rejects.toThrow()
        expect(console.error).toHaveBeenCalledTimes(1)
    })
})
