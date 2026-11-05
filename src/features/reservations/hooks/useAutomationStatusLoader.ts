"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PriorityLoadQueue } from "@/lib/priority-load-queue"
import type { AutomationStatus, Reservation } from "@/types"
import { reservationsService } from "../services/reservations-service"

/** Consultas de semáforo en vuelo a la vez (una por reserva). */
export const STATUS_CONCURRENCY = 6

/**
 * Lo que se sabe del semáforo de una reserva. Ausente = todavía cargando;
 * `failed` = la consulta falló, que NO es «sin automatizaciones».
 */
type StatusEntry = { ok: true; status: AutomationStatus } | { ok: false }

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
        return () => {
            queue.dispose()
            queueRef.current = null
            waiters.forEach((release) => release())
            waiters.clear()
        }
    }, [])

    const missing = (rows: readonly Reservation[]) => rows.filter((row) => !entriesRef.current.has(row.id))

    /** Filas en pantalla sin semáforo todavía (ni fallido): adelante de todo. */
    const prioritize = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(missing(rows), true)
    }, [])

    /** La página siguiente: detrás de lo visible, para que al pasar ya esté. */
    const prefetch = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(missing(rows), false)
    }, [])

    /** Vuelve a pedir estas filas aunque ya tengan semáforo (refresco de lo visible). */
    const renew = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(rows, true)
    }, [])

    /** Reintenta UNA fila que falló, adelante de todo. */
    const retry = useCallback((row: Reservation) => {
        const next = new Map(entriesRef.current)
        next.delete(row.id)
        entriesRef.current = next
        setEntries(next)
        queueRef.current?.request([row], true)
    }, [])

    /**
     * Completa el semáforo de TODAS estas filas (para ordenar por una columna
     * de estado) pidiendo solo las que faltan. La promesa resuelve cuando todas
     * tienen resultado (un fallo cuenta como resultado), con cuántas fallaron;
     * o como cancelada. `cancel` retira de la cola lo que sigue esperando
     * turno: quien cancela vuelve a pedir lo que sí necesita (lo visible).
     */
    const ensure = useCallback((rows: readonly Reservation[]): StatusPreparation => {
        const requested = missing(rows)
        queueRef.current?.request(requested, true)
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
                queueRef.current?.withdraw(requested.map((row) => row.id))
                release()
            },
        }
    }, [])

    /** Las filas con lo que se sabe: semáforo, fallo o nada (cargando). */
    const withStatus = useCallback(
        (rows: readonly Reservation[]): Reservation[] =>
            rows.map((row) => {
                const entry = entries.get(row.id)
                if (!entry) return row
                return entry.ok ? { ...row, automationStatus: entry.status } : { ...row, automationStatusFailed: true }
            }),
        [entries],
    )

    /** Cuántas de estas filas ya tienen resultado (para «N de M»). */
    const settledCount = useCallback(
        (rows: readonly Reservation[]) => rows.filter((row) => entries.has(row.id)).length,
        [entries],
    )

    return { prioritize, prefetch, renew, retry, ensure, withStatus, settledCount }
}
