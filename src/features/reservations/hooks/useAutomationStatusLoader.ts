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

/**
 * Semáforo de automatizaciones por reserva, cargado aparte de la lista: las
 * filas que se ven van primero (`prioritize`), el resto se rellena de fondo
 * (`fill`), de a `STATUS_CONCURRENCY`. Antes `list()` pedía las N de golpe y
 * la pantalla esperaba a la última.
 *
 * Un refresco de la lista vuelve a pedir todas (`fill`) sin borrar lo que se
 * ve: cada semáforo se reemplaza cuando llega el nuevo. Una fila que falló no
 * se vuelve a pedir sola al pasar por pantalla (contra un backend caído sería
 * un bucle): se reintenta con `retry` o con el próximo refresco.
 */
export function useAutomationStatusLoader() {
    const [entries, setEntries] = useState<ReadonlyMap<string, StatusEntry>>(() => new Map())
    // La misma tabla, legible desde callbacks estables sin esperar un render.
    const entriesRef = useRef(entries)
    const queueRef = useRef<PriorityLoadQueue<Reservation> | null>(null)

    useEffect(() => {
        const write = (id: string, entry: StatusEntry) => {
            entriesRef.current = new Map(entriesRef.current).set(id, entry)
            setEntries(entriesRef.current)
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
        }
    }, [])

    /** Filas en pantalla sin semáforo todavía (ni fallido): adelante de todo. */
    const prioritize = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(rows.filter((row) => !entriesRef.current.has(row.id)), true)
    }, [])

    /** Toda la lista (nueva o refrescada): de fondo, detrás de lo visible. */
    const fill = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(rows, false)
    }, [])

    /** Reintenta UNA fila que falló, adelante de todo. */
    const retry = useCallback((row: Reservation) => {
        const next = new Map(entriesRef.current)
        next.delete(row.id)
        entriesRef.current = next
        setEntries(next)
        queueRef.current?.request([row], true)
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

    return { prioritize, fill, retry, withStatus }
}
