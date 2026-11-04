import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ prefetch: vi.fn() }))
vi.mock("./reservation-detail-cache", () => ({ prefetchReservationDetail: mocks.prefetch }))

import { PREFETCH_INTENT_MS, cancelDetailPrefetch, startDetailPrefetch } from "./detail-prefetch"

describe("detail-prefetch — intención, no paso del cursor", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("salir antes del umbral no precarga; quedarse sí, una sola vez", () => {
        startDetailPrefetch("r1")
        vi.advanceTimersByTime(PREFETCH_INTENT_MS - 1)
        cancelDetailPrefetch("r1")
        vi.advanceTimersByTime(PREFETCH_INTENT_MS)
        expect(mocks.prefetch).not.toHaveBeenCalled()

        startDetailPrefetch("r2")
        startDetailPrefetch("r2")
        vi.advanceTimersByTime(PREFETCH_INTENT_MS)
        expect(mocks.prefetch).toHaveBeenCalledTimes(1)
        expect(mocks.prefetch).toHaveBeenCalledWith("r2")
    })
})
