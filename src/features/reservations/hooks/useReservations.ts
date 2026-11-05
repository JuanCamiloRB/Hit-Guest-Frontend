"use client"

import { useEffect, useRef } from "react"
import { useCachedLoad } from "@/hooks/useCachedLoad"
import { createStaleCache } from "@/lib/stale-cache"
import type { Reservation } from "@/types"
import { ReservationsNotReadyError, reservationsService } from "../services/reservations-service"

/**
 * La lista de reservas que comparten Operaciones, el Calendario y el Tablero:
 * volver a cualquiera de los tres muestra la última lista al instante mientras
 * se refresca detrás, y los tres piden una sola vez.
 */
export const reservationsCache = createStaleCache((signal) => reservationsService.list(signal))

/** Solo para tests. */
export function resetReservationsCache(): void {
    reservationsCache.reset()
}

/** Reintentos ante un «todavía no» (202) de la lista, y la espera entre ellos. */
export const NOT_READY_RETRIES = 3
export const NOT_READY_RETRY_MS = 2500
/**
 * Al volver a la pestaña se relee la lista (un huésped puede terminar su
 * check-in desde su celular mientras el PM tiene esto abierto), pero no más de
 * una vez cada minuto.
 */
export const REFRESH_ON_FOCUS_MIN_MS = 60_000

export type { LoadStatus as ListStatus } from "@/hooks/useCachedLoad"

interface ReservationsState {
    /** `null` mientras no hay lista; después, la última buena. */
    reservations: Reservation[] | null
    status: "loading" | "refreshing" | "ready" | "error"
    /** El backend respondió 202 (sincronizando): se reintenta solo. */
    syncing: boolean
    /** Había lista, la actualización falló y se sigue mostrando la anterior. */
    refreshFailed: boolean
    /** Sube con cada lista que llega del servidor (no con `patch`). */
    version: number
    /** Vuelve a pedir conservando lo que se ve. */
    refresh: () => void
}

const LIST_OPTIONS = {
    isRetryable: (error: unknown) => error instanceof ReservationsNotReadyError,
    retries: NOT_READY_RETRIES,
    retryMs: NOT_READY_RETRY_MS,
    // Una reserva creada o editada desde cualquier pantalla tiene que
    // aparecer sin recargar la página.
    refreshOn: ["reservationCreated"],
}

/**
 * Estado de la lista para una pantalla. Sin UI: cada pantalla decide qué decir
 * con `syncing` o `refreshFailed`. Un fallo nunca borra lo ya cargado; un 202
 * se reintenta `NOT_READY_RETRIES` veces sin vaciar nada.
 */
export function useReservations(): ReservationsState {
    const { data, status, retrying, refreshFailed, version, refresh } = useCachedLoad(reservationsCache, LIST_OPTIONS)

    // Sin esqueleto: se refresca en silencio sobre lo que ya se ve.
    const lastLoadAt = useRef(0)
    useEffect(() => {
        lastLoadAt.current = Date.now()
    }, [version])
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "visible" && Date.now() - lastLoadAt.current >= REFRESH_ON_FOCUS_MIN_MS) {
                lastLoadAt.current = Date.now()
                refresh()
            }
        }
        document.addEventListener("visibilitychange", onVisibility)
        return () => document.removeEventListener("visibilitychange", onVisibility)
    }, [refresh])

    return { reservations: data, status, syncing: retrying, refreshFailed, version, refresh }
}
