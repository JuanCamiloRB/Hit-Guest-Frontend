import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Reservation } from "@/types"

const mocks = vi.hoisted(() => ({ list: vi.fn(), bffFetch: vi.fn() }))

vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))

vi.mock("../services/reservations-service", () => ({
    ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
    reservationsService: { list: mocks.list },
}))

import { ReservationsNotReadyError } from "../services/reservations-service"
import { resetPropertiesCaches } from "@/features/properties/lib/properties-cache"
import { NOT_READY_RETRY_MS, REFRESH_ON_FOCUS_MIN_MS, resetReservationsCache, useReservations } from "./useReservations"

const rows = (...ids: string[]) => ids.map((id) => ({ id } as Reservation))

describe("useReservations", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetReservationsCache()
        resetPropertiesCaches()
        // Sin portafolio: las filas quedan como vinieron de la lista.
        mocks.bffFetch.mockReturnValue(new Promise(() => {}))
        vi.spyOn(console, "error").mockImplementation(() => {})
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("primera carga: loading → ready con la lista", async () => {
        mocks.list.mockResolvedValue(rows("a"))
        const { result } = renderHook(() => useReservations())
        expect(result.current.status).toBe("loading")
        expect(result.current.reservations).toBeNull()

        await waitFor(() => expect(result.current.status).toBe("ready"))
        expect(result.current.reservations?.map((r) => r.id)).toEqual(["a"])
    })

    it("volver a montar muestra la lista anterior de inmediato (refreshing) y la reemplaza al llegar", async () => {
        mocks.list.mockResolvedValueOnce(rows("a"))
        const first = renderHook(() => useReservations())
        await waitFor(() => expect(first.result.current.status).toBe("ready"))
        first.unmount()

        let release!: (value: Reservation[]) => void
        mocks.list.mockReturnValueOnce(new Promise<Reservation[]>((res) => { release = res }))
        const second = renderHook(() => useReservations())
        expect(second.result.current.status).toBe("refreshing")
        expect(second.result.current.reservations?.map((r) => r.id)).toEqual(["a"])

        await act(async () => release(rows("a", "b")))
        await waitFor(() => expect(second.result.current.status).toBe("ready"))
        expect(second.result.current.reservations).toHaveLength(2)
    })

    it("un 202 se reintenta solo sin vaciar nada; agotado, es error con syncing", async () => {
        vi.useFakeTimers()
        mocks.list.mockRejectedValue(new ReservationsNotReadyError("202"))
        const { result } = renderHook(() => useReservations())

        for (let i = 0; i < 3; i++) {
            await act(async () => { await vi.advanceTimersByTimeAsync(NOT_READY_RETRY_MS) })
        }
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(mocks.list).toHaveBeenCalledTimes(4)
        expect(result.current.status).toBe("error")
        expect(result.current.syncing).toBe(true)
    })

    it("si la actualización falla, se conserva la lista y se avisa", async () => {
        mocks.list.mockResolvedValueOnce(rows("a")).mockRejectedValueOnce(new Error("503"))
        const { result } = renderHook(() => useReservations())
        await waitFor(() => expect(result.current.status).toBe("ready"))

        act(() => result.current.refresh())
        await waitFor(() => expect(result.current.refreshFailed).toBe(true))
        expect(result.current.status).toBe("ready")
        expect(result.current.reservations?.map((r) => r.id)).toEqual(["a"])
    })

    it("reservationCreated refresca; volver a la pestaña solo si pasó más de un minuto", async () => {
        vi.useFakeTimers()
        mocks.list.mockResolvedValue(rows("a"))
        const { result } = renderHook(() => useReservations())
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(result.current.status).toBe("ready")
        expect(mocks.list).toHaveBeenCalledTimes(1)

        await act(async () => {
            window.dispatchEvent(new Event("reservationCreated"))
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(mocks.list).toHaveBeenCalledTimes(2)

        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"))
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(mocks.list).toHaveBeenCalledTimes(2)

        await act(async () => {
            await vi.advanceTimersByTimeAsync(REFRESH_ON_FOCUS_MIN_MS)
            document.dispatchEvent(new Event("visibilitychange"))
            await vi.advanceTimersByTimeAsync(0)
        })
        expect(mocks.list).toHaveBeenCalledTimes(3)
    })
})

describe("useReservations — nombres del portafolio, fuera del camino crítico", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetReservationsCache()
        resetPropertiesCaches()
    })

    const PORTFOLIO = {
        properties: [{ uuid: "p-1", name: "Casa Mar" }],
        listings: [{ uuid: "l-1", property_uuid: "p-1", name: "Suite", internalName: "101" }],
    }
    const fila = { id: "a", unitId: "l-1", propertyId: "", propertyName: "", unitName: "Suite" } as Reservation

    it("la lista se ve sin esperar el portafolio y se completa cuando llega", async () => {
        let release!: (value: unknown) => void
        mocks.bffFetch.mockReturnValueOnce(new Promise((res) => { release = res }))
        mocks.list.mockResolvedValue([fila])
        const { result } = renderHook(() => useReservations())

        await waitFor(() => expect(result.current.status).toBe("ready"))
        // Cargando, no «no disponible»: nada respondió todavía.
        expect(result.current.reservations?.[0].propertyName).toBe("")

        await act(async () => release(PORTFOLIO))
        await waitFor(() => expect(result.current.reservations?.[0]).toMatchObject({
            propertyId: "p-1", propertyName: "Casa Mar", unitName: "Suite (101)",
        }))
        expect(mocks.bffFetch).toHaveBeenCalledWith("/api/bff/properties-with-listings")
    })

    it("un portafolio ya cargado se reutiliza: no se vuelve a pedir al volver", async () => {
        mocks.bffFetch.mockResolvedValue(PORTFOLIO)
        mocks.list.mockResolvedValue([fila])
        const first = renderHook(() => useReservations())
        await waitFor(() => expect(first.result.current.reservations?.[0].propertyName).toBe("Casa Mar"))
        first.unmount()

        const second = renderHook(() => useReservations())
        expect(second.result.current.reservations?.[0].propertyName).toBe("Casa Mar")
        await waitFor(() => expect(second.result.current.status).toBe("ready"))
        expect(mocks.bffFetch).toHaveBeenCalledTimes(1)
    })

    it("si el portafolio falla, la fila dice «Propiedad no disponible» y se reintenta al volver a la pestaña", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        mocks.bffFetch.mockRejectedValueOnce(new Error("503"))
        mocks.list.mockResolvedValue([fila])
        const { result } = renderHook(() => useReservations())
        await waitFor(() => expect(result.current.reservations?.[0].propertyName).toBe("Propiedad no disponible"))

        mocks.bffFetch.mockResolvedValueOnce(PORTFOLIO)
        await act(async () => { document.dispatchEvent(new Event("visibilitychange")) })
        await waitFor(() => expect(result.current.reservations?.[0].propertyName).toBe("Casa Mar"))
        expect(mocks.bffFetch).toHaveBeenCalledTimes(2)
    })
})

describe("useReservations — carreras y desmontaje", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetReservationsCache()
        resetPropertiesCaches()
        mocks.bffFetch.mockReturnValue(new Promise(() => {}))
        vi.spyOn(console, "error").mockImplementation(() => {})
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("una carga lenta reemplazada por reservationCreated nunca se ve como error", async () => {
        let releaseSlow!: (value: Reservation[]) => void
        let releaseFresh!: (value: Reservation[]) => void
        mocks.list
            .mockReturnValueOnce(new Promise<Reservation[]>((res) => { releaseSlow = res }))
            .mockReturnValueOnce(new Promise<Reservation[]>((res) => { releaseFresh = res }))
        const { result } = renderHook(() => useReservations())
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1))

        act(() => { window.dispatchEvent(new Event("reservationCreated")) })
        await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2))

        await act(async () => releaseSlow(rows("vieja")))
        expect(result.current.status).toBe("loading")
        expect(result.current.reservations).toBeNull()

        await act(async () => releaseFresh(rows("nueva")))
        await waitFor(() => expect(result.current.status).toBe("ready"))
        expect(result.current.reservations?.map((r) => r.id)).toEqual(["nueva"])
    })

    it("desmontar durante los reintentos del 202 corta la cadena", async () => {
        vi.useFakeTimers()
        mocks.list.mockRejectedValue(new ReservationsNotReadyError("202"))
        const { unmount } = renderHook(() => useReservations())
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(mocks.list).toHaveBeenCalledTimes(1)

        unmount()
        await act(async () => { await vi.advanceTimersByTimeAsync(NOT_READY_RETRY_MS * 4) })
        expect(mocks.list).toHaveBeenCalledTimes(1)
    })
})
