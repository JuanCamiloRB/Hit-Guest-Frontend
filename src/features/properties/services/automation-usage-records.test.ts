import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/api-client", () => ({
    apiClient: { get: mocks.get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    handleSessionExpired: vi.fn(),
}))

import { automationService } from "./automation-service"

describe("automationService.listUsageRecords — cancelación (tablero, fase 1)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("entrega el mismo AbortSignal a apiClient.get", async () => {
        mocks.get.mockResolvedValue({ data: [] })
        const controller = new AbortController()

        await automationService.listUsageRecords("res-1", undefined, controller.signal)

        expect(mocks.get).toHaveBeenCalledWith(
            expect.stringMatching(/\/reservations\/res-1\/automation-records$/),
            { signal: controller.signal },
        )
    })

    it("una cancelación se propaga sin registrarse como error", async () => {
        const aborted = new DOMException("The operation was aborted.", "AbortError")
        mocks.get.mockRejectedValue(aborted)

        await expect(automationService.listUsageRecords("res-1", undefined, new AbortController().signal)).rejects.toBe(aborted)
        expect(console.error).not.toHaveBeenCalled()
    })

    it("un fallo real sí se registra y se propaga", async () => {
        const failure = new Error("HTTP 500")
        mocks.get.mockRejectedValue(failure)

        await expect(automationService.listUsageRecords("res-1")).rejects.toBe(failure)
        expect(console.error).toHaveBeenCalledWith("[AutomationService] listUsageRecords error:", failure)
    })
})
