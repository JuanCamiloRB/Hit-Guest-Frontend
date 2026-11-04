"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PriorityLoadQueue } from "@/lib/priority-load-queue"
import type { AutomationStatus, Reservation } from "@/types"
import { reservationsService } from "../services/reservations-service"

/** Consultas de semáforo en vuelo a la vez (una por reserva). */
export const STATUS_CONCURRENCY = 6

/**
 * Semáforo de automatizaciones por reserva, cargado aparte de la lista: las
 * filas que se ven van primero (`prioritize`), el resto se rellena de fondo
 * (`fill`), de a `STATUS_CONCURRENCY`. Antes `list()` pedía las N de golpe y
 * la pantalla esperaba a la última.
 *
 * Un refresco de la lista vuelve a pedir todas (`fill`) sin borrar lo que se
 * ve: cada semáforo se reemplaza cuando llega el nuevo.
 */
export function useAutomationStatusLoader() {
    const [statuses, setStatuses] = useState<ReadonlyMap<string, AutomationStatus>>(() => new Map())
    // La misma tabla, legible desde callbacks estables sin esperar un render.
    const statusesRef = useRef(statuses)
    const queueRef = useRef<PriorityLoadQueue<Reservation> | null>(null)

    useEffect(() => {
        const queue = new PriorityLoadQueue<Reservation>(
            STATUS_CONCURRENCY,
            (reservation) => reservation.id,
            async (reservation, signal) => {
                const status = await reservationsService.loadAutomationStatus(reservation, signal)
                if (signal.aborted) return
                statusesRef.current = new Map(statusesRef.current).set(reservation.id, status)
                setStatuses(statusesRef.current)
            },
        )
        queueRef.current = queue
        return () => {
            queue.dispose()
            queueRef.current = null
        }
    }, [])

    /** Filas en pantalla sin semáforo todavía: adelante de todo. */
    const prioritize = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(rows.filter((row) => !statusesRef.current.has(row.id)), true)
    }, [])

    /** Toda la lista (nueva o refrescada): de fondo, detrás de lo visible. */
    const fill = useCallback((rows: readonly Reservation[]) => {
        queueRef.current?.request(rows, false)
    }, [])

    /** Las filas con el semáforo que ya llegó; las demás quedan `undefined` (cargando). */
    const withStatus = useCallback(
        (rows: readonly Reservation[]): Reservation[] =>
            rows.map((row) => {
                const automationStatus = statuses.get(row.id)
                return automationStatus ? { ...row, automationStatus } : row
            }),
        [statuses],
    )

    return { prioritize, fill, withStatus }
}
