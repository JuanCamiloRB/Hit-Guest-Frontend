import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AutomationStatus, Reservation } from "@/types"

const mocks = vi.hoisted(() => ({ loadAutomationStatus: vi.fn() }))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { loadAutomationStatus: mocks.loadAutomationStatus },
}))

import { resetAutomationStatusMemory, useAutomationStatusLoader } from "./useAutomationStatusLoader"

const row = (id: string) => ({ id } as Reservation)
const rows = (...ids: string[]) => ids.map(row)
const light = (checkin: AutomationStatus["checkin"]) => ({ checkin } as AutomationStatus)

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

const statusOf = (result: { current: ReturnType<typeof useAutomationStatusLoader> }, id: string) =>
    result.current.withStatus([row(id)])[0]

describe("useAutomationStatusLoader — solo lo necesario", () => {
    beforeEach(() => {
        // mockReset, no clearAllMocks: una implementación que nunca resuelve no
        // puede pasar de un test al siguiente.
        mocks.loadAutomationStatus.mockReset()
        resetAutomationStatusMemory()
    })

    it("lo visible se adelanta a la página siguiente que todavía espera turno", async () => {
        const order: string[] = []
        const gates = new Map<string, ReturnType<typeof deferred<AutomationStatus>>>()
        mocks.loadAutomationStatus.mockImplementation((reservation: Reservation) => {
            order.push(reservation.id)
            const gate = deferred<AutomationStatus>()
            gates.set(reservation.id, gate)
            return gate.promise
        })
        const { result } = renderHook(() => useAutomationStatusLoader())

        // Ocho de la página siguiente: salen seis (el límite) y dos esperan turno.
        const next = rows("n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8")
        act(() => result.current.prefetch(next))
        await waitFor(() => expect(order).toHaveLength(6))
        // Lo visible se adelanta a lo que todavía espera turno.
        act(() => result.current.prioritize(rows("v1", "v2")))
        gates.get("n1")!.resolve(light("success"))
        gates.get("n2")!.resolve(light("success"))
        await waitFor(() => expect(order.slice(6)).toEqual(["v1", "v2"]))

        gates.forEach((gate) => gate.resolve(light("success")))
        await waitFor(() => expect(order).toHaveLength(10))
        expect(order.slice(8)).toEqual(["n7", "n8"])
    })

    it("lo ya cargado no se vuelve a pedir al verlo; renew sí, sin borrarlo hasta que llega lo nuevo", async () => {
        mocks.loadAutomationStatus.mockResolvedValueOnce(light("pending"))
        const { result } = renderHook(() => useAutomationStatusLoader())
        act(() => result.current.prioritize(rows("a")))
        await waitFor(() => expect(statusOf(result, "a").automationStatus?.checkin).toBe("pending"))

        act(() => result.current.prioritize(rows("a")))
        expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(1)

        const fresh = deferred<AutomationStatus>()
        mocks.loadAutomationStatus.mockReturnValueOnce(fresh.promise)
        act(() => result.current.renew(rows("a")))
        await waitFor(() => expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(2))
        expect(statusOf(result, "a").automationStatus?.checkin).toBe("pending")
        await act(async () => fresh.resolve(light("success")))
        await waitFor(() => expect(statusOf(result, "a").automationStatus?.checkin).toBe("success"))
    })

    it("un fallo marca la fila, no se repite al verla y se reintenta a pedido", async () => {
        mocks.loadAutomationStatus.mockRejectedValueOnce(new Error("503"))
        const { result } = renderHook(() => useAutomationStatusLoader())
        act(() => result.current.prioritize(rows("a")))
        await waitFor(() => expect(statusOf(result, "a").automationStatusFailed).toBe(true))

        act(() => result.current.prioritize(rows("a")))
        expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(1)

        mocks.loadAutomationStatus.mockResolvedValueOnce(light("success"))
        act(() => result.current.retry(row("a")))
        expect(statusOf(result, "a").automationStatusFailed).toBeUndefined()
        await waitFor(() => expect(statusOf(result, "a").automationStatus?.checkin).toBe("success"))
    })

    it("ensure pide solo lo que falta y resuelve cuando todo terminó, con cuántas fallaron", async () => {
        mocks.loadAutomationStatus.mockResolvedValueOnce(light("success"))
        const { result } = renderHook(() => useAutomationStatusLoader())
        act(() => result.current.prioritize(rows("a")))
        await waitFor(() => expect(statusOf(result, "a").automationStatus).toBeDefined())

        mocks.loadAutomationStatus
            .mockResolvedValueOnce(light("pending"))
            .mockRejectedValueOnce(new Error("503"))
        let outcome: unknown
        await act(async () => {
            outcome = await result.current.ensure(rows("a", "b", "c")).promise
        })

        expect(outcome).toEqual({ cancelled: false, failed: 1 })
        expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(3)
        expect(result.current.settledCount(rows("a", "b", "c"))).toBe(3)
    })

    it("al desmontar se cancela lo en vuelo y no se escribe estado después", async () => {
        let seen: AbortSignal | undefined
        mocks.loadAutomationStatus.mockImplementation((_r: Reservation, signal: AbortSignal) => {
            seen = signal
            return new Promise<AutomationStatus>((resolve) => signal.addEventListener("abort", () => resolve(light("none"))))
        })
        const { result, unmount } = renderHook(() => useAutomationStatusLoader())
        act(() => result.current.prioritize(rows("a")))
        await waitFor(() => expect(seen).toBeDefined())

        unmount()
        expect(seen?.aborted).toBe(true)
    })

    it("cancelar una preparación de 500: lo en vuelo termina, las que esperaban turno no salen y la promesa resuelve cancelada", async () => {
        const started: string[] = []
        const gates: Array<() => void> = []
        mocks.loadAutomationStatus.mockImplementation((reservation: Reservation) => {
            started.push(reservation.id)
            return new Promise<AutomationStatus>((resolve) => gates.push(() => resolve(light("success"))))
        })
        const { result } = renderHook(() => useAutomationStatusLoader())
        const all = Array.from({ length: 500 }, (_, i) => row(`r${i}`))

        let preparation!: ReturnType<typeof result.current.ensure>
        act(() => { preparation = result.current.ensure(all) })
        await waitFor(() => expect(started).toHaveLength(6))

        act(() => preparation.cancel())
        await expect(preparation.promise).resolves.toEqual({ cancelled: true })
        // Quien cancela vuelve a pedir lo visible (10) y la página siguiente (10).
        act(() => {
            result.current.prioritize(all.slice(0, 10))
            result.current.prefetch(all.slice(10, 20))
        })
        for (let i = 0; i < 40 && gates.length > 0; i++) {
            await act(async () => { gates.splice(0).forEach((open) => open()) })
        }

        expect(started).toHaveLength(20)
        expect(started.every((id) => Number(id.slice(1)) < 20)).toBe(true)
    })

    it("al desmontar, una preparación pendiente resuelve cancelada (nunca queda colgada)", async () => {
        mocks.loadAutomationStatus.mockImplementation(() => new Promise(() => {}))
        const { result, unmount } = renderHook(() => useAutomationStatusLoader())
        let preparation!: ReturnType<typeof result.current.ensure>
        act(() => { preparation = result.current.ensure(rows("a")) })
        unmount()
        await expect(preparation.promise).resolves.toEqual({ cancelled: true })
    })
})

describe("useAutomationStatusLoader — lo consultado vale al volver (DS: límite por minuto)", () => {
    beforeEach(() => {
        mocks.loadAutomationStatus.mockReset()
        resetAutomationStatusMemory()
    })

    it("al volver a la pantalla, lo consultado hace un momento no se vuelve a pedir; renew sí", async () => {
        mocks.loadAutomationStatus.mockResolvedValue(light("success"))
        const first = renderHook(() => useAutomationStatusLoader())
        act(() => first.result.current.prioritize(rows("a", "b")))
        await waitFor(() => expect(statusOf(first.result, "b").automationStatus).toBeDefined())
        expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(2)
        first.unmount()

        const second = renderHook(() => useAutomationStatusLoader())
        expect(statusOf(second.result, "a").automationStatus).toBeDefined()
        act(() => second.result.current.prioritize(rows("a", "b", "c")))
        await waitFor(() => expect(statusOf(second.result, "c").automationStatus).toBeDefined())
        // Solo «c» era nueva.
        expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(3)

        act(() => second.result.current.renew(rows("a")))
        await waitFor(() => expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(4))
    })

    it("un fallo no se recuerda entre montajes: al volver se vuelve a pedir", async () => {
        mocks.loadAutomationStatus.mockRejectedValue(new Error("x"))
        const first = renderHook(() => useAutomationStatusLoader())
        act(() => first.result.current.prioritize(rows("a")))
        await waitFor(() => expect(statusOf(first.result, "a").automationStatusFailed).toBe(true))
        first.unmount()

        mocks.loadAutomationStatus.mockResolvedValue(light("success"))
        const second = renderHook(() => useAutomationStatusLoader())
        act(() => second.result.current.prioritize(rows("a")))
        await waitFor(() => expect(statusOf(second.result, "a").automationStatus).toBeDefined())
    })

    it("con el freno de 429 vigente, lo que espera turno falla en el acto sin salir a la red", async () => {
        const { noteRateLimited, resetRateLimit } = await import("@/lib/rate-limit")
        noteRateLimited(30)
        mocks.loadAutomationStatus.mockResolvedValue(light("success"))
        const { result } = renderHook(() => useAutomationStatusLoader())
        act(() => result.current.prioritize(rows("a", "b")))
        await waitFor(() => expect(statusOf(result, "b").automationStatusFailed).toBe(true))
        expect(mocks.loadAutomationStatus).not.toHaveBeenCalled()
        resetRateLimit()
    })
})
