"use client"

import { useCachedLoad, type LoadStatus } from "@/hooks/useCachedLoad"
import { detailCacheFor } from "../lib/reservation-detail-cache"
import type { ReservationDetailData } from "../services/reservations-service"

interface ReservationDetailState {
    data: ReservationDetailData | null
    status: LoadStatus
    /** Había ficha, la actualización falló y se sigue mostrando la anterior. */
    refreshFailed: boolean
    errorMessage: string | null
    /** Vuelve a pedir conservando lo que se ve. */
    reload: () => void
}

const DETAIL_OPTIONS = {
    // `ReservationDialog` lo emite también al editar: la ficha debe reflejarlo.
    refreshOn: ["reservationCreated"],
}

/** La ficha de una reserva: si ya estaba precargada, se ve al instante y se revalida detrás. */
export function useReservationDetail(uuid: string): ReservationDetailState {
    const { data, status, refreshFailed, errorMessage, refresh } = useCachedLoad(detailCacheFor(uuid), DETAIL_OPTIONS)
    return { data, status, refreshFailed, errorMessage, reload: refresh }
}
