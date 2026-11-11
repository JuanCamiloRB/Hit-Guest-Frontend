import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReservationCost, ReservationCostFailure, ReservationCostsResult } from "../types"

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    getReservationCosts: vi.fn(),
    bffFetch: vi.fn(),
}))

vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))

vi.mock("@/features/reservations/services/reservations-service", () => ({
    ReservationsNotReadyError: class ReservationsNotReadyError extends Error {},
    reservationsService: { list: mocks.list },
}))
vi.mock("../services/consumption-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/consumption-service")>()
    return {
        ...actual,
        // Solo se dobla la red; el análisis es el real.
        consumptionService: {
            getReservationCosts: mocks.getReservationCosts,
            analyze: actual.consumptionService.analyze.bind(actual.consumptionService),
        },
    }
})

import { resetReservationsCache } from "@/features/reservations/hooks/useReservations"
import { resetPropertiesCaches } from "@/features/properties/lib/properties-cache"
import { resetBillingDataCache, useBillingData } from "./useBillingData"
import { ReservationsNotReadyError } from "@/features/reservations/services/reservations-service"

const thisMonth = new Date()

function cost(id: string, total: number): ReservationCost {
    return {
        reservationId: id,
        guestName: `Huésped ${id}`,
        unitName: "101",
        propertyName: "Pullman",
        checkIn: thisMonth,
        lineItems: [],
        total,
        nodeRuns: [],
    }
}

function failure(id: string): ReservationCostFailure {
    return { reservationId: id, guestName: `Huésped ${id}`, unitName: "102", propertyName: "Pullman", checkIn: thisMonth }
}

function result(costs: ReservationCost[], failedReservations: ReservationCostFailure[] = []): ReservationCostsResult {
    return { costs, failedReservations }
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

describe("useBillingData — un error nunca se ve como 0 USD", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetBillingDataCache()
        resetReservationsCache()
        resetPropertiesCaches()
        mocks.bffFetch.mockRejectedValue(new Error("BFF error 503"))
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.list.mockResolvedValue([{ id: "a" }])
        mocks.getReservationCosts.mockResolvedValue(result([cost("a", 2.5)]))
    })

    it("no espera al portafolio: el consumo se pide y se muestra; los nombres llegan después", async () => {
        let release!: (value: unknown) => void
        mocks.bffFetch.mockReturnValueOnce(new Promise((res) => { release = res }))
        mocks.list.mockResolvedValue([{ id: "a", unitId: "l-1", propertyName: "" }])
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).toBe("ready"))
        expect(hook.current.costs[0]).toMatchObject({ unitName: "101", propertyName: "Pullman" })

        await act(async () => release({
            properties: [{ uuid: "p-1", name: "Casa Mar" }],
            listings: [{ uuid: "l-1", property_uuid: "p-1", name: "Suite", internalName: "101" }],
        }))
        await waitFor(() => expect(hook.current.costs[0]).toMatchObject({ unitName: "Suite (101)", propertyName: "Casa Mar" }))
        expect(hook.current.summary?.monthTotal).toBe(2.5)
    })

    it("éxito: ready, con las cifras calculadas", async () => {
        const { result: hook } = renderHook(() => useBillingData())
        expect(hook.current.status).toBe("loading")
        expect(hook.current.summary).toBeNull()

        await waitFor(() => expect(hook.current.status).toBe("ready"))
        expect(hook.current.summary?.monthTotal).toBe(2.5)
        expect(hook.current.costs).toHaveLength(1)
    })

    it("vacío real (cero reservas): ready, y aquí 0 sí es un dato", async () => {
        mocks.list.mockResolvedValue([])
        mocks.getReservationCosts.mockResolvedValue(result([]))
        const { result: hook } = renderHook(() => useBillingData())

        await waitFor(() => expect(hook.current.status).toBe("ready"))
        expect(hook.current.summary?.monthTotal).toBe(0)
    })

    it("error total (falla la lista de reservas): error, sin cifras", async () => {
        mocks.list.mockRejectedValue(new Error("network down"))
        const { result: hook } = renderHook(() => useBillingData())

        await waitFor(() => expect(hook.current.status).toBe("error"))
        expect(hook.current.summary).toBeNull()
        expect(hook.current.costs).toEqual([])
        expect(hook.current.monthly).toEqual([])
        expect(mocks.getReservationCosts).not.toHaveBeenCalled()
    })

    it("un 202 se presenta como sincronización, no como error total", async () => {
        mocks.list.mockRejectedValue(new ReservationsNotReadyError("syncing"))
        const { result: hook } = renderHook(() => useBillingData())

        await waitFor(() => expect(hook.current.status).toBe("syncing"))
        expect(hook.current.syncing).toBe(true)
        expect(hook.current.summary).toBeNull()
    })

    it("error total (fallan TODAS las consultas): error, no un parcial con todo en cero", async () => {
        mocks.getReservationCosts.mockResolvedValue(result([], [failure("a"), failure("b")]))
        const { result: hook } = renderHook(() => useBillingData())

        await waitFor(() => expect(hook.current.status).toBe("error"))
        expect(hook.current.summary).toBeNull()
    })

    it("parcial: las fallidas quedan aparte y fuera de los totales", async () => {
        mocks.getReservationCosts.mockResolvedValue(result([cost("a", 2.5)], [failure("b")]))
        const { result: hook } = renderHook(() => useBillingData())

        await waitFor(() => expect(hook.current.status).toBe("partial"))
        expect(hook.current.failedReservations.map((f) => f.reservationId)).toEqual(["b"])
        expect(hook.current.summary?.monthTotal).toBe(2.5)
        expect(hook.current.summary?.lifetime.processedReservations).toBe(1)
    })

    it("reintentar tras un error total recupera sin recargar el navegador", async () => {
        mocks.list.mockRejectedValueOnce(new Error("network down"))
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).toBe("error"))

        act(() => hook.current.retry())
        expect(hook.current.status).toBe("loading")
        await waitFor(() => expect(hook.current.status).toBe("ready"))
        expect(hook.current.summary?.monthTotal).toBe(2.5)
    })
})

describe("useBillingData — actualizar no borra lo que se ve", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetBillingDataCache()
        resetReservationsCache()
        resetPropertiesCaches()
        mocks.bffFetch.mockRejectedValue(new Error("BFF error 503"))
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.list.mockResolvedValue([{ id: "a" }])
        mocks.getReservationCosts.mockResolvedValue(result([cost("a", 2.5)]))
    })

    it("una reserva creada desde el encabezado recarga, conservando los datos mientras tanto", async () => {
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).toBe("ready"))

        const pending = deferred<ReservationCostsResult>()
        mocks.getReservationCosts.mockReturnValueOnce(pending.promise)
        act(() => { window.dispatchEvent(new Event("reservationCreated")) })

        await waitFor(() => expect(hook.current.status).toBe("refreshing"))
        expect(hook.current.summary?.monthTotal).toBe(2.5)
        expect(mocks.list).toHaveBeenCalledTimes(2)

        await act(async () => pending.resolve(result([cost("a", 2.5), cost("b", 1)])))
        await waitFor(() => expect(hook.current.status).toBe("ready"))
        expect(hook.current.summary?.monthTotal).toBe(3.5)
    })

    it("si la actualización falla, se conservan los datos y se avisa", async () => {
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).toBe("ready"))

        mocks.list.mockRejectedValueOnce(new Error("network down"))
        act(() => hook.current.retry())
        await waitFor(() => expect(hook.current.refreshFailed).toBe(true))

        expect(hook.current.status).toBe("ready")
        expect(hook.current.summary?.monthTotal).toBe(2.5)
    })

    it("carrera: una respuesta vieja que llega tarde no pisa la más reciente", async () => {
        const first = deferred<ReservationCostsResult>()
        const second = deferred<ReservationCostsResult>()
        mocks.getReservationCosts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(mocks.getReservationCosts).toHaveBeenCalledTimes(1))
        act(() => hook.current.retry())
        await waitFor(() => expect(mocks.getReservationCosts).toHaveBeenCalledTimes(2))

        await act(async () => second.resolve(result([cost("nueva", 9)])))
        await waitFor(() => expect(hook.current.status).toBe("ready"))
        await act(async () => first.resolve(result([cost("vieja", 1)])))

        expect(hook.current.costs.map((c) => c.reservationId)).toEqual(["nueva"])
        expect(hook.current.summary?.monthTotal).toBe(9)
    })

    it("reintentar aborta la carga anterior antes de iniciar la nueva", async () => {
        let firstSignal: AbortSignal | undefined
        mocks.getReservationCosts
            .mockImplementationOnce((_reservations, signal: AbortSignal) => {
                firstSignal = signal
                return new Promise<ReservationCostsResult>(() => {})
            })
            .mockResolvedValueOnce(result([cost("nueva", 9)]))

        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(firstSignal).toBeDefined())
        act(() => hook.current.retry())

        await waitFor(() => expect(mocks.getReservationCosts).toHaveBeenCalledTimes(2))
        expect(firstSignal?.aborted).toBe(true)
        await waitFor(() => expect(hook.current.status).toBe("ready"))
    })

    it("al desmontar aborta la carga para no despachar consultas pendientes", async () => {
        let receivedSignal: AbortSignal | undefined
        mocks.getReservationCosts.mockImplementationOnce((_reservations, signal: AbortSignal) => {
            receivedSignal = signal
            return new Promise<ReservationCostsResult>(() => {})
        })
        const { unmount } = renderHook(() => useBillingData())
        await waitFor(() => expect(receivedSignal).toBeDefined())

        unmount()
        expect(receivedSignal?.aborted).toBe(true)
    })
})

describe("useBillingData — volver al Tablero muestra lo último mientras actualiza", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetBillingDataCache()
        resetReservationsCache()
        resetPropertiesCaches()
        mocks.bffFetch.mockRejectedValue(new Error("BFF error 503"))
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.list.mockResolvedValue([{ id: "a" }])
        mocks.getReservationCosts.mockResolvedValue(result([cost("a", 2.5)]))
    })

    it("al volver arranca en refreshing con los datos anteriores, no en el skeleton", async () => {
        const first = renderHook(() => useBillingData())
        await waitFor(() => expect(first.result.current.status).toBe("ready"))
        first.unmount()

        const pending = deferred<ReservationCostsResult>()
        mocks.getReservationCosts.mockReturnValueOnce(pending.promise)
        const { result: hook } = renderHook(() => useBillingData())

        expect(hook.current.status).toBe("refreshing")
        expect(hook.current.summary?.monthTotal).toBe(2.5)
        await act(async () => pending.resolve(result([cost("a", 2.5), cost("b", 1)])))
        await waitFor(() => expect(hook.current.status).toBe("ready"))
        expect(hook.current.summary?.monthTotal).toBe(3.5)
    })

    it("si la actualización al volver falla, se ven los anteriores con el aviso", async () => {
        const first = renderHook(() => useBillingData())
        await waitFor(() => expect(first.result.current.status).toBe("ready"))
        first.unmount()

        mocks.list.mockRejectedValueOnce(new Error("network down"))
        const { result: hook } = renderHook(() => useBillingData())

        await waitFor(() => expect(hook.current.refreshFailed).toBe(true))
        expect(hook.current.summary?.monthTotal).toBe(2.5)
    })

    it("si al volver fallan algunas consultas, esas reservas conservan su último consumo (no pasan a «no disponible»)", async () => {
        // El caso reportado: primera visita con todo cargado; al volver, la
        // mayoría de las consultas falla y la tabla quedaba en «Consumo no
        // disponible» para reservas cuyo consumo ya se conocía.
        mocks.list.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }])
        mocks.getReservationCosts.mockResolvedValueOnce(result([cost("a", 2.5), cost("b", 1), cost("c", 0.5)]))
        const first = renderHook(() => useBillingData())
        await waitFor(() => expect(first.result.current.status).toBe("ready"))
        first.unmount()

        mocks.getReservationCosts.mockResolvedValueOnce(result([cost("a", 3)], [failure("b"), failure("c")]))
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).not.toBe("refreshing"))

        // a se actualiza; b y c conservan lo último conocido, en su orden.
        expect(hook.current.costs.map((c) => [c.reservationId, c.total])).toEqual([["a", 3], ["b", 1], ["c", 0.5]])
        expect(hook.current.failedReservations).toEqual([])
        expect(hook.current.summary?.monthTotal).toBe(4.5)
        // Y se avisa que parte de lo que se ve no se pudo actualizar.
        expect(hook.current.refreshFailed).toBe(true)
    })

    it("una reserva sin consumo previo que falla sí va a «no disponible»", async () => {
        mocks.list.mockResolvedValue([{ id: "a" }, { id: "b" }])
        mocks.getReservationCosts.mockResolvedValueOnce(result([cost("a", 2.5)]))
        const first = renderHook(() => useBillingData())
        await waitFor(() => expect(first.result.current.status).toBe("ready"))
        first.unmount()

        mocks.getReservationCosts.mockResolvedValueOnce(result([cost("a", 2.5)], [failure("b")]))
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).toBe("partial"))
        expect(hook.current.failedReservations.map((f) => f.reservationId)).toEqual(["b"])
        expect(hook.current.refreshFailed).toBe(false)
    })

    it("un error nunca queda guardado: sin una carga buena previa, volver arranca en loading", async () => {
        mocks.list.mockRejectedValueOnce(new Error("network down"))
        const first = renderHook(() => useBillingData())
        await waitFor(() => expect(first.result.current.status).toBe("error"))
        first.unmount()

        const { result: hook } = renderHook(() => useBillingData())
        expect(hook.current.status).toBe("loading")
        await waitFor(() => expect(hook.current.status).toBe("ready"))
    })
})

describe("useBillingData — la carga inicial pinta lo que ya llegó", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetBillingDataCache()
        resetReservationsCache()
        resetPropertiesCaches()
        mocks.bffFetch.mockRejectedValue(new Error("BFF error 503"))
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.list.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }])
    })

    it("sin datos previos, costs crece con cada consulta y loadingProgress dice cuántas van; summary espera", async () => {
        const pending = deferred<ReservationCostsResult>()
        let report!: (progress: { done: number; total: number; index: number; cost: ReservationCost | null }) => void
        mocks.getReservationCosts.mockImplementationOnce((_r, _s, onProgress) => {
            report = onProgress
            return pending.promise
        })
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(report).toBeDefined())

        // Llega primero la tercera y después la primera: la tabla las muestra
        // en el orden de la lista, no en el de llegada.
        act(() => report({ done: 1, total: 3, index: 2, cost: cost("c", 1) }))
        act(() => report({ done: 2, total: 3, index: 1, cost: null }))
        act(() => report({ done: 3, total: 3, index: 0, cost: cost("a", 2.5) }))
        expect(hook.current.status).toBe("loading")
        expect(hook.current.summary).toBeNull()
        expect(hook.current.costs.map((c) => c.reservationId)).toEqual(["a", "c"])
        expect(hook.current.loadingProgress).toEqual({ done: 3, total: 3 })

        await act(async () => pending.resolve(result([cost("a", 2.5), cost("c", 1)], [failure("b")])))
        await waitFor(() => expect(hook.current.status).toBe("partial"))
        expect(hook.current.loadingProgress).toBeNull()
        expect(hook.current.costs).toHaveLength(2)
    })

    it("con datos en pantalla, una actualización no los reemplaza a medias", async () => {
        mocks.getReservationCosts.mockResolvedValueOnce(result([cost("a", 2.5)]))
        const { result: hook } = renderHook(() => useBillingData())
        await waitFor(() => expect(hook.current.status).toBe("ready"))

        const pending = deferred<ReservationCostsResult>()
        let onProgress: unknown
        mocks.getReservationCosts.mockImplementationOnce((_r, _s, cb) => {
            onProgress = cb
            return pending.promise
        })
        act(() => hook.current.retry())
        await waitFor(() => expect(hook.current.status).toBe("refreshing"))

        expect(onProgress).toBeUndefined()
        expect(hook.current.loadingProgress).toBeNull()
        expect(hook.current.costs.map((c) => c.reservationId)).toEqual(["a"])
        await act(async () => pending.resolve(result([cost("a", 2.5), cost("b", 1)])))
        await waitFor(() => expect(hook.current.costs).toHaveLength(2))
    })
})
