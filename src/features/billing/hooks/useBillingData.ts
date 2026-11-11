"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { startOfMonth } from "date-fns"
import { ReservationsNotReadyError } from "@/features/reservations/services/reservations-service"
import { reservationsCache } from "@/features/reservations/hooks/useReservations"
import { withListingNames } from "@/features/reservations/lib/listing-names"
import { useListingPortfolio } from "@/features/reservations/hooks/useListingPortfolio"
import { consumptionService, type CostLoadProgress } from "../services/consumption-service"
import { isRateLimitError } from "@/lib/rate-limit"
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
    /**
     * El backend pidió esperar (429): con datos visibles se conservan; sin
     * ellos, `status: "error"`. En los dos casos el aviso dice «en un minuto».
     */
    rateLimited: boolean
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
    constructor(count: number, public readonly rateLimited: boolean) {
        super(`ninguna de las ${count} consultas de consumo respondió`)
        this.name = "AllCostRequestsFailedError"
    }
}

/**
 * Cuánto vale lo ya consultado antes de volver a pedirlo (por reserva y para
 * la lista). Entrar al Tablero disparaba UNA consulta por reserva cada vez,
 * aunque se hubiera salido un segundo antes: ir y volver entre pantallas
 * agotaba el límite por minuto del backend (429) y todo quedaba «no
 * disponible». Dentro de la ventana no se pide nada; `retry` y una reserva
 * nueva (`reservationCreated`) sí fuerzan la consulta.
 */
export const COSTS_FRESH_MS = 2 * 60_000
export const LIST_FRESH_MS = 60_000

/**
 * Última carga buena. Volver al Tablero la muestra de inmediato (`refreshing`)
 * mientras se actualiza, en vez de reiniciar desde el skeleton. Un error nunca
 * se guarda. No hace falta segmentarla por cuenta: todo cambio de cuenta
 * (logout, 401, entrar o salir de soporte) recarga el documento y reinicia el
 * módulo (ver `support-session.ts`).
 */
let lastResult: ReservationCostsResult | null = null
/** Cuándo se consultó bien el consumo de cada reserva (epoch ms). */
let costFetchedAt = new Map<string, number>()
let listFetchedAt = 0

/** Solo para tests: olvida la última carga. */
export function resetBillingDataCache(): void {
    lastResult = null
    costFetchedAt = new Map()
    listFetchedAt = 0
}

/** Solo para tests: lo cargado sigue, pero ya no cuenta como fresco. */
export function expireBillingDataCache(): void {
    costFetchedAt = new Map()
    listFetchedAt = 0
}

/** Solo para tests: solo la lista deja de estar fresca; el consumo por reserva sigue. */
export function expireBillingListCache(): void {
    listFetchedAt = 0
}

/**
 * Mezcla lo recién consultado con lo que ya se sabía, en el orden de la
 * lista. Una reserva que no se consultó (estaba fresca) o cuya consulta falló
 * conserva su último consumo conocido: un refresco parcial no borra datos que
 * estaban en pantalla un momento antes. Solo va a «no disponible» la que
 * nunca se pudo consultar. `stale` = cuántas se pidieron y se quedaron con el
 * valor anterior, para avisar.
 */
function mergeCosts(
    reservations: { id: string }[],
    queried: ReadonlySet<string>,
    loaded: ReservationCostsResult,
    previous: ReservationCostsResult | null,
): { result: ReservationCostsResult; stale: number } {
    const fresh = new Map(loaded.costs.map((c) => [c.reservationId, c]))
    const known = new Map(previous?.costs.map((c) => [c.reservationId, c]) ?? [])
    const failed = new Map(loaded.failedReservations.map((f) => [f.reservationId, f]))
    const costs: ReservationCost[] = []
    const failedReservations: ReservationCostFailure[] = []
    let stale = 0
    const placed = new Set<string>()
    for (const { id } of reservations) {
        placed.add(id)
        const cost = fresh.get(id) ?? known.get(id)
        if (cost) {
            if (!fresh.has(id) && queried.has(id)) stale += 1
            costs.push(cost)
        } else {
            const failure = failed.get(id)
            if (failure) failedReservations.push(failure)
        }
    }
    // Lo que el servicio devolvió y no está en la lista no se descarta: es
    // un dato real (la lista pudo cambiar entre una consulta y otra).
    for (const c of loaded.costs) if (!placed.has(c.reservationId)) costs.push(c)
    for (const f of loaded.failedReservations) if (!placed.has(f.reservationId)) failedReservations.push(f)
    return { result: { costs, failedReservations, rateLimited: loaded.rateLimited }, stale }
}

/** Los nombres que trae cada fila de consumo, actualizados con los del portafolio. */
function withNames<T extends { reservationId: string; unitName: string; propertyName: string }>(
    rows: T[],
    names: Map<string, { unitName: string; propertyName: string }> | null,
): T[] {
    if (!names || rows.length === 0) return rows
    return rows.map((row) => {
        const named = names.get(row.reservationId)
        return named ? { ...row, unitName: named.unitName, propertyName: named.propertyName } : row
    })
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
    const [lastLoadIssue, setLastLoadIssue] = useState<"error" | "syncing" | "rate-limited" | null>(null)
    /** Solo la solicitud más reciente escribe el estado. */
    const requestId = useRef(0)
    const activeController = useRef<AbortController | null>(null)

    // Normalized to the 1st so the month-selector arrows can't drift the day and
    // land on a shorter month (Jan 31 → Feb 31).
    const [refMonth, setRefMonthState] = useState(() => startOfMonth(new Date()))
    const setRefMonth = useCallback((month: Date) => setRefMonthState(startOfMonth(month)), [])

    /** `force`: reintento o reserva nueva; ignora la ventana de frescura. */
    const fetchCosts = useCallback(async (force = false) => {
        const id = ++requestId.current
        activeController.current?.abort()
        const controller = new AbortController()
        activeController.current = controller
        try {
            // La misma lista que Operaciones y el Calendario (dedupe y último
            // valor). Los nombres del portafolio no se esperan: se ponen al
            // mostrar (`withNames`), así el BFF no retrasa ninguna consulta.
            // Dentro de la ventana se usa la lista ya cargada, sin pedirla.
            const cachedList = reservationsCache.read()
            const listFresh = !force && cachedList !== null && Date.now() - listFetchedAt < LIST_FRESH_MS
            const reservations = listFresh ? cachedList : await reservationsCache.load()
            if (!listFresh) listFetchedAt = Date.now()
            if (controller.signal.aborted) return
            // Solo lo que no está fresco. Sin datos previos, todo.
            const known = lastResult
            const now = Date.now()
            const toQuery = force || known === null
                ? reservations
                : reservations.filter((r) => now - (costFetchedAt.get(r.id) ?? 0) >= COSTS_FRESH_MS)
            const queried = new Set(toQuery.map((r) => r.id))
            // Progresivo solo sin datos en pantalla (`lastResult` es lo que se
            // ve): una actualización conserva lo anterior hasta tener el
            // resultado completo (fase 1).
            const progressive = known === null
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
            // Con datos en pantalla y nada vencido no se consulta nada. La
            // primera carga siempre consulta (aunque la lista venga vacía).
            const loaded: ReservationCostsResult = toQuery.length > 0 || known === null
                ? await consumptionService.getReservationCosts(toQuery, controller.signal, onProgress)
                : { costs: [], failedReservations: [] }
            // Sin nada previo que conservar, un fallo de todas es un error total.
            if (known === null && loaded.costs.length === 0 && loaded.failedReservations.length > 0) {
                throw new AllCostRequestsFailedError(loaded.failedReservations.length, loaded.rateLimited === true)
            }
            if (id !== requestId.current) return
            const fetchedAt = Date.now()
            for (const c of loaded.costs) costFetchedAt.set(c.reservationId, fetchedAt)
            const { result, stale } = mergeCosts(reservations, queried, loaded, known)
            lastResult = result
            setData(result)
            // Con valores anteriores a la vista, se avisa igual que un refresco fallido.
            setLastLoadIssue(loaded.rateLimited ? "rate-limited" : stale > 0 ? "error" : null)
        } catch (error) {
            if (id !== requestId.current || controller.signal.aborted) return
            console.error("[useBillingData] consumo no disponible:", error)
            // Lo anterior se conserva: un fallo no reemplaza datos por ceros.
            const rateLimited = isRateLimitError(error) || (error instanceof AllCostRequestsFailedError && error.rateLimited)
            setLastLoadIssue(error instanceof ReservationsNotReadyError ? "syncing" : rateLimited ? "rate-limited" : "error")
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
        void fetchCosts(true)
    }, [fetchCosts])

    // Suscribirse además cuenta al Tablero como consumidor de la lista
    // compartida: sin eso, la caché cancelaría su carga por «nadie mirando».
    const list = useSyncExternalStore(reservationsCache.subscribe, reservationsCache.read, () => null)
    const portfolio = useListingPortfolio()
    /** Propiedad y alojamiento de cada reserva, cuando el portafolio respondió. */
    const names = useMemo(
        () => (list && portfolio ? new Map(withListingNames(list, portfolio).map((r) => [r.id, r])) : null),
        [list, portfolio],
    )

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
    const costs = useMemo(() => withNames(data?.costs ?? partialCosts, names), [data, partialCosts, names])
    const failedReservations = useMemo(() => withNames(data?.failedReservations ?? [], names), [data, names])

    const status: ConsumptionStatus = !data
        ? inFlight ? "loading" : lastLoadIssue === "syncing" ? "syncing" : "error"
        : inFlight ? "refreshing"
        : data.failedReservations.length > 0 ? "partial" : "ready"

    return {
        status,
        costs,
        loadingProgress: !data && partial ? { done: partial.done, total: partial.byIndex.length } : null,
        failedReservations,
        refreshFailed: data !== null && (lastLoadIssue === "error" || lastLoadIssue === "rate-limited") && !inFlight,
        rateLimited: lastLoadIssue === "rate-limited" && !inFlight,
        syncing: lastLoadIssue === "syncing" && !inFlight,
        summary: analytics?.summary ?? null,
        monthly: analytics?.monthly ?? [],
        topNodes: analytics?.topNodes ?? [],
        refMonth,
        setRefMonth,
        retry,
    }
}
