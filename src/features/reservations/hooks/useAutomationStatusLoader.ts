"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PriorityLoadQueue } from "@/lib/priority-load-queue"
import type { AutomationStatus, Reservation } from "@/types"
import { reservationsService } from "../services/reservations-service"

/** Consultas de semáforo en vuelo a la vez (una por reserva). */
export const STATUS_CONCURRENCY = 6

/**
 * Lo que se sabe del semáforo de una reserva. Ausente = todavía cargando;
 * `ok: false` = la consulta falló, que NO es «sin automatizaciones». Un fallo
 * que se está reintentando sigue contando como resultado (`retrying`): la
 * celda muestra que carga, pero un orden por estado ya completo no vuelve a
 * «Preparando…» por un reintento.
 */
type StatusEntry = { ok: true; status: AutomationStatus } | { ok: false; retrying?: true }

/**
 * Lo que se sabía de los semáforos en un momento dado: para ordenar con esos
 * valores mientras llegan los nuevos, sin que la tabla salte con cada uno.
 */
export type StatusSnapshot = ReadonlyMap<string, StatusEntry>

/** Cómo terminó una preparación (`ensure`): con todo, o cancelada. */
export type EnsureOutcome = { cancelled: false; failed: number } | { cancelled: true }

/** Una preparación en curso: se espera o se cancela; nunca queda colgada. */
export interface StatusPreparation {
    promise: Promise<EnsureOutcome>
    /** Retira lo que esta preparación dejó esperando turno (lo en vuelo termina). */
    cancel: () => void
}

/**
 * Semáforo de automatizaciones por reserva, cargado aparte de la lista y solo
 * para lo que hace falta: las filas que se ven (`prioritize`), la página
 * siguiente detrás (`prefetch`) y, al ordenar por una columna de estado, lo
 * que falte de toda la lista (`ensure`). Nunca la lista entera de golpe.
 *
 * Lo ya obtenido se conserva mientras la pantalla esté abierta. Un refresco
 * renueva solo lo visible (`renew`), sin borrarlo hasta que llega lo nuevo.
 * Una fila que falló no se vuelve a pedir sola al pasar por pantalla (contra
 * un backend caído sería un bucle): se reintenta con `retry` o con `renew`.
 */
export function useAutomationStatusLoader() {
    const [entries, setEntries] = useState<ReadonlyMap<string, StatusEntry>>(() => new Map())
    // La misma tabla, legible desde callbacks estables sin esperar un render.
    const entriesRef = useRef(entries)
    const queueRef = useRef<PriorityLoadQueue<Reservation> | null>(null)
    // Quien espera a que un conjunto de filas termine (`ensure`), con cómo
    // soltarlo si la pantalla se va.
    const waitersRef = useRef(new Map<() => void, () => void>())
    // Pedidos que llegan antes de que exista la cola. La tabla avisa sus filas
    // en SU efecto, y React corre los efectos de los hijos antes que los del
    // padre (donde se crea la cola). Con la lista en caché la tabla está desde
    // el primer render: sin esto, ese aviso se perdía y, como las filas no
    // cambian, la tabla no volvía a avisar (esqueletos hasta recargar).
    const earlyRef = useRef<Array<{ rows: readonly Reservation[]; front: boolean }>>([])
    const send = useCallback((rows: readonly Reservation[], front: boolean) => {
        const queue = queueRef.current
        if (queue) queue.request(rows, front)
        else earlyRef.current.push({ rows, front })
    }, [])

    useEffect(() => {
        const waiters = waitersRef.current
        const write = (id: string, entry: StatusEntry) => {
            entriesRef.current = new Map(entriesRef.current).set(id, entry)
            setEntries(entriesRef.current)
            waiters.forEach((_release, check) => check())
        }
        const queue = new PriorityLoadQueue<Reservation>(
            STATUS_CONCURRENCY,
            (reservation) => reservation.id,
            async (reservation, signal) => {
                try {
                    const status = await reservationsService.loadAutomationStatus(reservation, signal)
                    if (!signal.aborted) write(reservation.id, { ok: true, status })
                } catch {
                    // Cancelar (desmontaje) no es un fallo que mostrar.
                    if (!signal.aborted) write(reservation.id, { ok: false })
                }
            },
        )
        queueRef.current = queue
        // En el orden en que llegaron: lo visible delante, la siguiente detrás.
        for (const { rows, front } of earlyRef.current.splice(0)) queue.request(rows, front)
        return () => {
            queue.dispose()
            queueRef.current = null
            earlyRef.current = []
            waiters.forEach((release) => release())
            waiters.clear()
        }
    }, [])

    const missing = (rows: readonly Reservation[]) => rows.filter((row) => !entriesRef.current.has(row.id))

    /** Filas en pantalla sin semáforo todavía (ni fallido): adelante de todo. */
    const prioritize = useCallback((rows: readonly Reservation[]) => {
        send(missing(rows), true)
    }, [send])

    /** La página siguiente: detrás de lo visible, para que al pasar ya esté. */
    const prefetch = useCallback((rows: readonly Reservation[]) => {
        send(missing(rows), false)
    }, [send])

    /** Vuelve a pedir estas filas aunque ya tengan semáforo (refresco de lo visible). */
    const renew = useCallback((rows: readonly Reservation[]) => {
        send(rows, true)
    }, [send])

    /** Reintenta UNA fila que falló, adelante de todo. */
    const retry = useCallback((row: Reservation) => {
        const next = new Map(entriesRef.current)
        next.set(row.id, { ok: false, retrying: true })
        entriesRef.current = next
        setEntries(next)
        send([row], true)
    }, [send])

    /**
     * Completa el semáforo de TODAS estas filas (para ordenar por una columna
     * de estado) pidiendo solo las que faltan. La promesa resuelve cuando todas
     * tienen resultado (un fallo cuenta como resultado), con cuántas fallaron;
     * o como cancelada. `cancel` retira de la cola lo que sigue esperando
     * turno: quien cancela vuelve a pedir lo que sí necesita (lo visible).
     *
     * Operaciones no espera la promesa (deriva «Preparando…» de lo que ya
     * llegó); solo usa `cancel`. La promesa es el contrato de quien sí
     * necesite esperar, y nunca queda colgada.
     */
    const ensure = useCallback((rows: readonly Reservation[]): StatusPreparation => {
        const requested = missing(rows)
        send(requested, true)
        const waiters = waitersRef.current
        let check: () => void = () => {}
        let release: () => void = () => {}
        const promise = new Promise<EnsureOutcome>((resolve) => {
            check = () => {
                const current = entriesRef.current
                if (!rows.every((row) => current.has(row.id))) return
                waiters.delete(check)
                resolve({ cancelled: false, failed: rows.filter((row) => current.get(row.id)?.ok === false).length })
            }
            release = () => {
                waiters.delete(check)
                resolve({ cancelled: true })
            }
        })
        waiters.set(check, release)
        check()
        return {
            promise,
            cancel: () => {
                if (!waiters.has(check)) return
                // Solo la cola: `ensure` corre en efectos declarados después del
                // que la crea, así que nada suyo queda en `earlyRef`.
                queueRef.current?.withdraw(requested.map((row) => row.id))
                release()
            },
        }
    }, [send])

    /**
     * Las filas con lo que se sabe: semáforo, fallo o nada (cargando). Con
     * `sortBy`, el valor por el que se ORDENA sale de esa foto (lo que se ve
     * sigue en vivo): una fila que no estaba en la foto queda al final.
     */
    const withStatus = useCallback(
        (rows: readonly Reservation[], sortBy?: StatusSnapshot | null): Reservation[] =>
            rows.map((row) => {
                const entry = entries.get(row.id)
                const sortEntry = sortBy ? sortBy.get(row.id) : entry
                const automationStatusForSort = sortEntry?.ok ? sortEntry.status : undefined
                // Sin resultado, o reintentando: la celda dice que carga.
                if (!entry || (!entry.ok && entry.retrying)) return sortBy || entry ? { ...row, automationStatusForSort } : row
                return entry.ok
                    ? { ...row, automationStatus: entry.status, automationStatusForSort }
                    : { ...row, automationStatusFailed: true, automationStatusForSort }
            }),
        [entries],
    )

    /** Cuántas de estas filas ya tienen resultado (para «N de M»). */
    const settledCount = useCallback(
        (rows: readonly Reservation[]) => rows.filter((row) => entries.has(row.id)).length,
        [entries],
    )

    return { prioritize, prefetch, renew, retry, ensure, withStatus, settledCount, snapshot: entries as StatusSnapshot }
}
