"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { startOfMonth } from "date-fns"
import { ReservationsNotReadyError } from "@/features/reservations/services/reservations-service"
import { reservationsCache } from "@/features/reservations/hooks/useReservations"
import { consumptionService, type CostLoadProgress } from "../services/consumption-service"
import type {
    ConsumptionSummary,
    MonthlyPoint,
    NodeUsage,
    ReservationCost,
    ReservationCostFailure,
    ReservationCostsResult,
} from "../types"

/**
 * - `loading`: primera carga, todavía sin datos.
 * - `ready`: todos los consumos cargaron.
 * - `refreshing`: hay datos visibles y se están actualizando.
 * - `error`: no hay datos confiables (falló la lista o TODAS las consultas).
 * - `syncing`: reservas respondió 202; todavía se están sincronizando.
 * - `partial`: hay datos, pero algunas reservas no se pudieron consultar.
 */
export type ConsumptionStatus = "loading" | "ready" | "refreshing" | "error" | "partial" | "syncing"

interface BillingData {
    status: ConsumptionStatus
    /**
     * Reservas con consumo consultado. Durante la carga inicial (sin datos
     * previos) va creciendo a medida que llega cada consulta: la tabla las
     * pinta ya; las cifras esperan a `summary`.
     */
    costs: ReservationCost[]
    /** Avance de la carga inicial («N de M»); null fuera de ella. */
    loadingProgress: { done: number; total: number } | null
    /** Reservas cuyo consumo no se pudo consultar: fuera de toda cifra. */
    failedReservations: ReservationCostFailure[]
    /**
     * Una actualización falló y se siguen mostrando los datos anteriores.
     * Solo con datos visibles; sin datos, eso es `status: "error"`.
     */
    refreshFailed: boolean
    /** El backend respondió 202: conserva datos anteriores si existen. */
    syncing: boolean
    /** KPIs for `refMonth`; null mientras no hay datos confiables. */
    summary: ConsumptionSummary | null
    /** Six months ending at `refMonth`, oldest first. */
    monthly: MonthlyPoint[]
    /** Nodes executed during `refMonth`, most-run first. */
    topNodes: NodeUsage[]
    /** First day of the month the month-scoped panels are showing. */
    refMonth: Date
    setRefMonth: (month: Date) => void
    /** Vuelve a consultar el consumo conservando lo que ya se ve. */
    retry: () => void
}

/** Hubo reservas y no se pudo consultar ninguna: no hay nada que mostrar. */
class AllCostRequestsFailedError extends Error {
    constructor(count: number) {
        super(`ninguna de las ${count} consultas de consumo respondió`)
        this.name = "AllCostRequestsFailedError"
    }
}

/**
 * Última carga buena. Volver al Tablero la muestra de inmediato (`refreshing`)
 * mientras se actualiza, en vez de reiniciar desde el skeleton. Un error nunca
 * se guarda. No hace falta segmentarla por cuenta: todo cambio de cuenta
 * (logout, 401, entrar o salir de soporte) recarga el documento y reinicia el
 * módulo (ver `support-session.ts`).
 */
let lastResult: ReservationCostsResult | null = null

/** Solo para tests: olvida la última carga. */
export function resetBillingDataCache(): void {
    lastResult = null
}

/**
 * Consumo por reserva para el Tablero. El saldo NO vive aquí: lo comparte
 * `useBalanceStore` con el header y el banner, para que digan lo mismo.
 *
 * Reservations are fetched once here and reused for the costs, so the KPI cards
 * and the breakdown table share a single network pass. The month-scoped KPIs,
 * history and node ranking are derived from `costs` by `consumptionService.analyze`
 * — no extra request, and they stay in sync with the breakdown table by construction.
 *
 * Un fallo nunca se presenta como 0 USD: sin datos, `summary` es null; con
 * datos anteriores, se conservan y se avisa (`refreshFailed`).
 */
export function useBillingData(): BillingData {
    const [data, setData] = useState<ReservationCostsResult | null>(() => lastResult)
    /**
     * Solo en la carga inicial: lo que ya llegó, en la posición de su reserva
     * (`null` = todavía no, o falló), para pintarlo sin esperar al resto y sin
     * que la tabla se reordene al completarse.
     */
    const [partial, setPartial] = useState<{ byIndex: (ReservationCost | null)[]; done: number } | null>(null)
    // Arranca en true: la primera carga sale del efecto de montaje.
    const [inFlight, setInFlight] = useState(true)
    const [lastLoadIssue, setLastLoadIssue] = useState<"error" | "syncing" | null>(null)
    /** Solo la solicitud más reciente escribe el estado. */
    const requestId = useRef(0)
    const activeController = useRef<AbortController | null>(null)

    // Normalized to the 1st so the month-selector arrows can't drift the day and
    // land on a shorter month (Jan 31 → Feb 31).
    const [refMonth, setRefMonthState] = useState(() => startOfMonth(new Date()))
    const setRefMonth = useCallback((month: Date) => setRefMonthState(startOfMonth(month)), [])

    const fetchCosts = useCallback(async () => {
        const id = ++requestId.current
        activeController.current?.abort()
        const controller = new AbortController()
        activeController.current = controller
        try {
            // La misma lista que Operaciones y el Calendario (dedupe y último valor).
            const reservations = await reservationsCache.load()
            if (controller.signal.aborted) return
            // Progresivo solo sin datos en pantalla (`lastResult` es lo que se
            // ve): una actualización conserva lo anterior hasta tener el
            // resultado completo (fase 1).
            const progressive = lastResult === null
            if (progressive) setPartial({ byIndex: new Array(reservations.length).fill(null), done: 0 })
            const onProgress = progressive
                ? ({ done, index, cost }: CostLoadProgress) => {
                    if (id !== requestId.current) return
                    setPartial((prev) => {
                        if (!prev) return prev
                        const byIndex = prev.byIndex.slice()
                        byIndex[index] = cost
                        return { byIndex, done }
                    })
                }
                : undefined
            const result = await consumptionService.getReservationCosts(reservations, controller.signal, onProgress)
            if (result.costs.length === 0 && result.failedReservations.length > 0) {
                throw new AllCostRequestsFailedError(result.failedReservations.length)
            }
            if (id !== requestId.current) return
            lastResult = result
            setData(result)
            setLastLoadIssue(null)
        } catch (error) {
            if (id !== requestId.current || controller.signal.aborted) return
            console.error("[useBillingData] consumo no disponible:", error)
            // Lo anterior se conserva: un fallo no reemplaza datos por ceros.
            setLastLoadIssue(error instanceof ReservationsNotReadyError ? "syncing" : "error")
        } finally {
            if (id === requestId.current) {
                if (activeController.current === controller) activeController.current = null
                setPartial(null)
                setInFlight(false)
            }
        }
    }, [])

    const retry = useCallback(() => {
        setInFlight(true)
        void fetchCosts()
    }, [fetchCosts])

    // El Tablero cuenta como consumidor de la lista compartida mientras está
    // montado: sin esto, la caché cancelaría su carga por «nadie mirando».
    useEffect(() => reservationsCache.subscribe(() => {}), [])

    useEffect(() => {
        void fetchCosts()
        // El botón «Nueva Reserva» vive en el encabezado de este mismo Tablero:
        // sin esto, la reserva recién creada no aparecía hasta recargar la página.
        window.addEventListener("reservationCreated", retry)
        return () => {
            window.removeEventListener("reservationCreated", retry)
            // Invalida el estado y evita despachar consultas que sigan en cola.
            requestId.current += 1
            activeController.current?.abort()
            activeController.current = null
        }
    }, [fetchCosts, retry])

    // Derived, not fetched: changing the month re-slices the same `costs` with no
    // extra request, so the KPIs, history and node ranking can never disagree
    // with the breakdown table below them. Las reservas fallidas no entran.
    const analytics = useMemo(
        () => (data ? consumptionService.analyze(data.costs, refMonth) : null),
        [data, refMonth],
    )
    const partialCosts = useMemo(
        () => (partial ? partial.byIndex.filter((cost): cost is ReservationCost => cost !== null) : []),
        [partial],
    )

    const status: ConsumptionStatus = !data
        ? inFlight ? "loading" : lastLoadIssue === "syncing" ? "syncing" : "error"
        : inFlight ? "refreshing"
        : data.failedReservations.length > 0 ? "partial" : "ready"

    return {
        status,
        costs: data?.costs ?? partialCosts,
        loadingProgress: !data && partial ? { done: partial.done, total: partial.byIndex.length } : null,
        failedReservations: data?.failedReservations ?? [],
        refreshFailed: data !== null && lastLoadIssue === "error" && !inFlight,
        syncing: lastLoadIssue === "syncing" && !inFlight,
        summary: analytics?.summary ?? null,
        monthly: analytics?.monthly ?? [],
        topNodes: analytics?.topNodes ?? [],
        refMonth,
        setRefMonth,
        retry,
    }
}
