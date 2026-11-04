import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AutomationStatus, Reservation } from "@/types"

const mocks = vi.hoisted(() => ({ loadAutomationStatus: vi.fn() }))

vi.mock("../services/reservations-service", () => ({
    reservationsService: { loadAutomationStatus: mocks.loadAutomationStatus },
}))

import { useAutomationStatusLoader } from "./useAutomationStatusLoader"

const row = (id: string) => ({ id } as Reservation)
const light = (checkin: AutomationStatus["checkin"]) => ({ checkin } as AutomationStatus)

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => { resolve = res })
    return { promise, resolve }
}

describe("useAutomationStatusLoader", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("las filas visibles se consultan antes que el relleno, y withStatus las completa al llegar", async () => {
        const order: string[] = []
        const gates = new Map<string, ReturnType<typeof deferred<AutomationStatus>>>()
        mocks.loadAutomationStatus.mockImplementation((reservation: Reservation) => {
            order.push(reservation.id)
            const gate = deferred<AutomationStatus>()
            gates.set(reservation.id, gate)
            return gate.promise
        })
        const { result } = renderHook(() => useAutomationStatusLoader())
        const rows = Array.from({ length: 8 }, (_, i) => row(`r${i + 1}`))

        // Como en la pantalla: primero se encola toda la lista, después se ve una página.
        act(() => result.current.fill(rows))
        await waitFor(() => expect(order).toHaveLength(6))
        act(() => result.current.prioritize([row("r8"), row("r7")]))

        gates.get("r1")!.resolve(light("success"))
        await waitFor(() => expect(order[6]).toBe("r8"))
        await waitFor(() => expect(result.current.withStatus([row("r1")])[0].automationStatus?.checkin).toBe("success"))
        expect(result.current.withStatus([row("r2")])[0].automationStatus).toBeUndefined()
    })

    it("una fila ya cargada no se vuelve a pedir desde prioritize, pero fill (refresco) sí la renueva", async () => {
        mocks.loadAutomationStatus.mockResolvedValue(light("pending"))
        const { result } = renderHook(() => useAutomationStatusLoader())

        act(() => result.current.fill([row("a")]))
        await waitFor(() => expect(result.current.withStatus([row("a")])[0].automationStatus).toBeDefined())

        act(() => result.current.prioritize([row("a")]))
        expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(1)

        act(() => result.current.fill([row("a")]))
        await waitFor(() => expect(mocks.loadAutomationStatus).toHaveBeenCalledTimes(2))
    })

    it("al desmontar se cancela lo en vuelo y no se escribe estado después", async () => {
        let seen: AbortSignal | undefined
        mocks.loadAutomationStatus.mockImplementation((_r: Reservation, signal: AbortSignal) => {
            seen = signal
            return new Promise<AutomationStatus>((resolve) => signal.addEventListener("abort", () => resolve(light("none"))))
        })
        const { result, unmount } = renderHook(() => useAutomationStatusLoader())
        act(() => result.current.fill([row("a")]))
        await waitFor(() => expect(seen).toBeDefined())

        unmount()
        expect(seen?.aborted).toBe(true)
    })
})
