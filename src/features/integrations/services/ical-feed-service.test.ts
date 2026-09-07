import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { icalFeedService } from "./ical-feed-service"

vi.mock("@/lib/store/auth-store", () => ({
    useAuthStore: { getState: () => ({ user: { token: "token-1" } }) },
}))

function laravelPage(items: unknown[], page: number, lastPage: number) {
    return {
        ok: true,
        json: async () => ({ data: items, meta: { current_page: page, last_page: lastPage } }),
    } as Response
}

describe("icalFeedService.list — el envelope de Laravel se conserva", () => {
    beforeEach(() => { vi.stubGlobal("fetch", vi.fn()) })
    afterEach(() => { vi.unstubAllGlobals() })

    /**
     * El P0 de la auditoría del 2026-09-07: la primera versión usaba apiClient,
     * que DESENVUELVE `{ data }` automáticamente — `res.data` quedaba undefined,
     * el panel mostraba cero feeds y `meta` (las páginas siguientes) se perdía.
     * Este test consume el shape paginado REAL y falla si alguien vuelve a
     * apiClient.
     */
    it("junta todas las páginas leyendo data y meta del envelope crudo", async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(laravelPage([{ uuid: "feed-1" }], 1, 2))
            .mockResolvedValueOnce(laravelPage([{ uuid: "feed-2" }], 2, 2))

        const feeds = await icalFeedService.list()

        expect(feeds.map((f) => f.uuid)).toEqual(["feed-1", "feed-2"])
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("page=2")
    })

    it("una página que falla lanza — un listado parcial haría ver un feed como borrado", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ message: "boom" }),
        } as Response)

        await expect(icalFeedService.list()).rejects.toThrow()
    })
})
