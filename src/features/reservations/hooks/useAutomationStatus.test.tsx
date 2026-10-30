import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { automationActionKey, hasPendingWork, useAutomationStatus } from "./useAutomationStatus"
import type { AutomationGuestStatus, AutomationStatusItem } from "@/features/properties/types/automation"

const mocks = vi.hoisted(() => ({
    getReservationStatus: vi.fn(),
    dispatch: vi.fn(),
    redispatch: vi.fn(),
}))

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/features/properties/services/automation-service", () => ({
    automationService: {
        getReservationStatus: mocks.getReservationStatus,
        redispatch: mocks.redispatch,
        dispatch: mocks.dispatch,
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

describe("despacho por huésped (contrato 2026-10-27 §2.4–2.5)", () => {
    const guest = (uuid: string, over: Partial<AutomationGuestStatus> = {}): AutomationGuestStatus => ({
        guestUuid: uuid, name: uuid, isMainGuest: false, checkinCompleted: true, status: "not_started",
        usageRecordId: null, lastError: null, lastRunAt: null, canDispatch: true, canRedispatch: false, ...over,
    })
    const sire = (guests: AutomationGuestStatus[]): AutomationStatusItem => ({
        automationUuid: "sire", automationName: "SIRE", providerSlug: "sire_colombia", status: "not_started",
        lastError: null, lastRunAt: null, usageRecordId: null, contractPdfPath: null, wasSuccessful: false,
        lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: true,
        reservationCheckinCompleted: true, mainGuestCheckinCompleted: true, canDispatch: true, canRedispatch: false,
        isPerGuest: true, guests,
    })

    beforeEach(() => vi.clearAllMocks())

    it("las claves separan la automatización de cada huésped", () => {
        expect(automationActionKey("sire")).toBe("sire:reservation")
        expect(automationActionKey("sire", "g-1")).not.toBe(automationActionKey("sire", "g-2"))
    })

    it("un huésped en pending mantiene el sondeo aunque la automatización no lo esté", () => {
        expect(hasPendingWork([sire([guest("g-1", { status: "pending" })])])).toBe(true)
        expect(hasPendingWork([sire([guest("g-1", { status: "skipped" })])])).toBe(false)
    })

    it("despacha a UN huésped con su guestUuid, y sin huésped a todos los pendientes", async () => {
        const item = sire([guest("g-1"), guest("g-2")])
        mocks.getReservationStatus.mockResolvedValue([item])
        mocks.dispatch.mockResolvedValue({ message: "Automatización despachada para 1 huésped(es).", dispatchedGuests: ["g-1"] })
        const { result } = renderHook(() => useAutomationStatus("res-1"))

        await act(async () => { await result.current.dispatch(item, item.guests[0]) })
        expect(mocks.dispatch).toHaveBeenLastCalledWith("res-1", "sire", "g-1")

        await act(async () => { await result.current.dispatch(item) })
        expect(mocks.dispatch).toHaveBeenLastCalledWith("res-1", "sire", undefined)
    })

    it("reintenta con el usageRecordId del huésped, y el 429 de uno no bloquea al otro", async () => {
        const item = sire([guest("g-1", { status: "failed", usageRecordId: 11, canRedispatch: true }), guest("g-2", { status: "failed", usageRecordId: 22, canRedispatch: true })])
        mocks.getReservationStatus.mockResolvedValue([item])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("Too many"), { status: 429 }))
        const { result } = renderHook(() => useAutomationStatus("res-1"))

        await act(async () => { await result.current.redispatch(item, item.guests[0]) })
        expect(mocks.redispatch).toHaveBeenLastCalledWith("res-1", 11)
        expect(result.current.cooldownUntil[automationActionKey("sire", "g-1")]).toBeGreaterThan(Date.now())
        expect(result.current.cooldownUntil[automationActionKey("sire", "g-2")]).toBeUndefined()
    })
})
