import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAutomationStatus } from "./useAutomationStatus"

const mocks = vi.hoisted(() => ({
    getReservationStatus: vi.fn(),
}))

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/features/properties/services/automation-service", () => ({
    automationService: {
        getReservationStatus: mocks.getReservationStatus,
        redispatch: vi.fn(),
        dispatch: vi.fn(),
        resendPdf: vi.fn(),
    },
}))

const pendingItem = [{
    automationUuid: "automation-1",
    automationName: "TRA",
    providerSlug: "tra_colombia",
    status: "pending" as const,
    usageRecordId: 1,
}]

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
}

describe("useAutomationStatus polling lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => vi.useRealTimers())

    it("no recrea un timer zombi si se desmonta con un request en vuelo", async () => {
        const inFlight = deferred<typeof pendingItem>()
        mocks.getReservationStatus
            .mockResolvedValueOnce(pendingItem)
            .mockReturnValueOnce(inFlight.promise)

        const { unmount } = renderHook(() => useAutomationStatus("reservation-a"))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
        expect(mocks.getReservationStatus).toHaveBeenCalledTimes(2)

        unmount()
        await act(async () => {
            inFlight.resolve(pendingItem)
            await Promise.resolve()
        })
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })

        expect(mocks.getReservationStatus).toHaveBeenCalledTimes(2)
    })

    it("una respuesta vieja no escribe ni reprograma polling al cambiar de reserva", async () => {
        const oldRequest = deferred<typeof pendingItem>()
        mocks.getReservationStatus.mockImplementation((uuid: string) => {
            if (uuid === "reservation-a" && mocks.getReservationStatus.mock.calls.length === 2) {
                return oldRequest.promise
            }
            return Promise.resolve(uuid === "reservation-a" ? pendingItem : [])
        })

        const { rerender } = renderHook(
            ({ uuid }) => useAutomationStatus(uuid),
            { initialProps: { uuid: "reservation-a" } },
        )
        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })

        rerender({ uuid: "reservation-b" })
        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        await act(async () => {
            oldRequest.resolve(pendingItem)
            await Promise.resolve()
        })
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })

        expect(mocks.getReservationStatus.mock.calls.map(([uuid]) => uuid)).toEqual([
            "reservation-a",
            "reservation-a",
            "reservation-b",
        ])
    })
})
