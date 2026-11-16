import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { automationActionKey, hasPendingWork, isCredentialsPaused, useAutomationStatus } from "./useAutomationStatus"
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

describe("useAutomationStatus — credenciales rechazadas (nota backend 2026-11-11)", () => {
    const base = (over: Partial<AutomationStatusItem> = {}): AutomationStatusItem => ({
        automationUuid: "tra", automationName: "TRA", providerSlug: "tra_colombia", status: "pending",
        lastError: null, lastRunAt: null, usageRecordId: 7, contractPdfPath: null, wasSuccessful: false,
        lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: true,
        reservationCheckinCompleted: true, mainGuestCheckinCompleted: true, canDispatch: true, canRedispatch: true,
        isPerGuest: false, guests: [], ...over,
    })

    beforeEach(() => vi.clearAllMocks())

    it("una ejecución en pausa no mantiene el sondeo aunque llegue como pending (ni la fila ni un huésped)", () => {
        expect(hasPendingWork([base({ lastError: "credentials_rejected" })])).toBe(false)
        const guestPaused: AutomationGuestStatus = {
            guestUuid: "g-1", name: "Ana", isMainGuest: true, checkinCompleted: true, status: "pending",
            usageRecordId: null, lastError: "credentials_rejected", lastRunAt: null, canDispatch: false, canRedispatch: false,
        }
        expect(hasPendingWork([base({ status: "not_started", isPerGuest: true, guests: [guestPaused] })])).toBe(false)
        // Una pendiente de verdad sigue sondeando.
        expect(hasPendingWork([base({ lastError: "credentials_rejected" }), base({ automationUuid: "otra" })])).toBe(true)
    })

    it("en pausa se reconoce por la fila, por un huésped o por un 422 previo", () => {
        expect(isCredentialsPaused(base({ lastError: "credentials_rejected" }), new Set())).toBe(true)
        expect(isCredentialsPaused(base(), new Set([automationActionKey("tra")]))).toBe(true)
        expect(isCredentialsPaused(base({ lastError: "timeout" }), new Set())).toBe(false)
        const guestPaused = { guestUuid: "g", name: "Ana", isMainGuest: true, checkinCompleted: true, status: "failed", usageRecordId: 1, lastError: "credentials_rejected", lastRunAt: null, canDispatch: false, canRedispatch: true } as AutomationGuestStatus
        expect(isCredentialsPaused(base({ isPerGuest: true, guests: [guestPaused] }), new Set())).toBe(true)
    })

    it("lo completado no está en pausa aunque arrastre el código (fila o huésped)", () => {
        expect(isCredentialsPaused(base({ status: "completed", lastError: "credentials_rejected" }), new Set())).toBe(false)
        const done = { guestUuid: "g", name: "Ana", isMainGuest: true, checkinCompleted: true, status: "completed", usageRecordId: 1, lastError: "credentials_rejected", lastRunAt: null, canDispatch: false, canRedispatch: false } as AutomationGuestStatus
        expect(isCredentialsPaused(base({ status: "completed", isPerGuest: true, guests: [done] }), new Set())).toBe(false)
    })

    it("un pending de arriba que solo resume huéspedes en pausa no mantiene el sondeo", () => {
        const paused = { guestUuid: "g", name: "Ana", isMainGuest: true, checkinCompleted: true, status: "pending", usageRecordId: 1, lastError: "credentials_rejected", lastRunAt: null, canDispatch: false, canRedispatch: false } as AutomationGuestStatus
        expect(hasPendingWork([base({ status: "pending", isPerGuest: true, guests: [paused] })])).toBe(false)
        // Si otro huésped sí se está procesando, se sigue sondeando.
        expect(hasPendingWork([base({ status: "pending", isPerGuest: true, guests: [paused, { ...paused, guestUuid: "g2", lastError: null }] })])).toBe(true)
    })

    it("la marca del 422 se olvida solo con una ejecución más nueva que la del 422", async () => {
        const item = base({ status: "failed", lastRunAt: "2026-11-11 08:15:02", usageRecordId: 7 })
        mocks.getReservationStatus.mockResolvedValue([item])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("En pausa"), { status: 422, code: "CREDENTIALS_REJECTED" }))
        const { result } = renderHook(() => useAutomationStatus("res-1"))
        await act(async () => { await result.current.redispatch(item) })
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)

        // Un completed SIN ejecución nueva puede ser una lectura atrasada: no levanta nada.
        mocks.getReservationStatus.mockResolvedValue([{ ...item, status: "completed" }])
        await act(async () => { await result.current.refresh() })
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)

        // El PM guardó las credenciales en otra pestaña y la reserva volvió a correr.
        mocks.getReservationStatus.mockResolvedValue([{ ...item, status: "completed", lastRunAt: "2026-11-11 09:40:00", usageRecordId: 8 }])
        await act(async () => { await result.current.refresh() })
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(false)
    })

    it("el 422 CREDENTIALS_REJECTED deja la automatización marcada, avisa con el mensaje del backend y resincroniza", async () => {
        const { toast } = await import("sonner")
        const item = base({ status: "failed" })
        mocks.getReservationStatus.mockResolvedValue([item])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("Un proveedor rechazó las credenciales…"), { status: 422, code: "CREDENTIALS_REJECTED" }))
        const { result } = renderHook(() => useAutomationStatus("res-1"))
        await act(async () => { await Promise.resolve() })
        const callsBefore = mocks.getReservationStatus.mock.calls.length

        await act(async () => { await result.current.redispatch(item) })

        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)
        expect(toast.error).toHaveBeenCalledWith("Credenciales rechazadas", { description: "Un proveedor rechazó las credenciales…" })
        expect(toast.info).not.toHaveBeenCalled()
        expect(mocks.getReservationStatus.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    it("lo mismo al despachar, y otro 422 sigue siendo el aviso genérico", async () => {
        const { toast } = await import("sonner")
        const item = base({ status: "not_started" })
        mocks.getReservationStatus.mockResolvedValue([item])
        mocks.dispatch
            .mockRejectedValueOnce(Object.assign(new Error("En pausa"), { status: 422, code: "CREDENTIALS_REJECTED" }))
            .mockRejectedValueOnce(Object.assign(new Error("Ya se ejecutó"), { status: 422 }))
        const { result } = renderHook(() => useAutomationStatus("res-1"))

        await act(async () => { await result.current.dispatch(item, { guestUuid: "g-1" } as AutomationGuestStatus) })
        // La pausa es de la configuración, no del huésped: se marca la automatización.
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)

        await act(async () => { await result.current.dispatch(base({ automationUuid: "pdf", status: "not_started" })) })
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("pdf"))).toBe(false)
        expect(toast.info).toHaveBeenCalledWith("Ya se ejecutó")
    })
})

describe("useAutomationStatus — 422 seguido de una lectura atrasada (auditoría 2026-11-16)", () => {
    const item = (over: Partial<AutomationStatusItem> = {}): AutomationStatusItem => ({
        automationUuid: "tra", automationName: "TRA", providerSlug: "tra_colombia", status: "failed",
        lastError: null, lastRunAt: "2026-11-11 08:15:02", usageRecordId: 7, contractPdfPath: null, wasSuccessful: false,
        lastSuccessAt: null, requiresCheckin: null, redispatchRequiresCheckin: null, canManualDispatch: true,
        reservationCheckinCompleted: true, mainGuestCheckinCompleted: true, canDispatch: true, canRedispatch: true,
        isPerGuest: false, guests: [], ...over,
    })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => vi.useRealTimers())

    it("422 → la lectura siguiente llega pending sin lastError → se mantiene la pausa y no se vuelve a consultar", async () => {
        mocks.getReservationStatus.mockResolvedValueOnce([item()])
        const { result } = renderHook(() => useAutomationStatus("res-1"))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })

        // Lectura atrasada: pending, sin el código, con la MISMA ejecución de antes.
        mocks.getReservationStatus.mockResolvedValue([item({ status: "pending" })])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("En pausa"), { status: 422, code: "CREDENTIALS_REJECTED" }))
        await act(async () => { await result.current.redispatch(item()) })

        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)
        expect(hasPendingWork(result.current.items, result.current.credentialsRejectedKeys)).toBe(false)
        const calls = mocks.getReservationStatus.mock.calls.length

        await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
        expect(mocks.getReservationStatus.mock.calls.length).toBe(calls)
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)
    })

    it("si OTRA automatización sigue pendiente, el sondeo continúa (solo se excluye la pausada)", async () => {
        const other = item({ automationUuid: "sire", status: "pending", lastRunAt: null, usageRecordId: null })
        mocks.getReservationStatus.mockResolvedValue([item({ status: "pending" }), other])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("En pausa"), { status: 422, code: "CREDENTIALS_REJECTED" }))
        const { result } = renderHook(() => useAutomationStatus("res-1"))
        await act(async () => { await Promise.resolve(); await Promise.resolve() })
        await act(async () => { await result.current.redispatch(item()) })
        const calls = mocks.getReservationStatus.mock.calls.length

        await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
        expect(mocks.getReservationStatus.mock.calls.length).toBe(calls + 1)
    })

    it("una ejecución nueva que vuelve a quedar en pausa no levanta la marca", async () => {
        vi.useRealTimers()
        mocks.getReservationStatus.mockResolvedValue([item()])
        mocks.redispatch.mockRejectedValueOnce(Object.assign(new Error("En pausa"), { status: 422, code: "CREDENTIALS_REJECTED" }))
        const { result } = renderHook(() => useAutomationStatus("res-1"))
        await act(async () => { await result.current.redispatch(item()) })

        // Más nueva, pero vuelve a traer el código y sin él la tarjeta se liberaría.
        mocks.getReservationStatus.mockResolvedValue([item({ status: "failed", lastRunAt: "2026-11-11 09:40:00", usageRecordId: 8, lastError: "credentials_rejected" })])
        await act(async () => { await result.current.refresh() })
        expect(result.current.credentialsRejectedKeys.has(automationActionKey("tra"))).toBe(true)
    })
})
