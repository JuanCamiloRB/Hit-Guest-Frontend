import { prefetchReservationDetail } from "./reservation-detail-cache"

/**
 * Cuánto tiene que quedarse el cursor (o el foco) en una fila para que cuente
 * como intención de abrirla. Atravesar la tabla con el mouse no precarga nada.
 */
export const PREFETCH_INTENT_MS = 150

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Al entrar en la fila: precarga la ficha si el cursor se queda. */
export function startDetailPrefetch(uuid: string): void {
    cancelDetailPrefetch(uuid)
    timers.set(uuid, setTimeout(() => {
        timers.delete(uuid)
        prefetchReservationDetail(uuid)
    }, PREFETCH_INTENT_MS))
}

/** Al salir de la fila antes de tiempo: no era intención. */
export function cancelDetailPrefetch(uuid: string): void {
    const timer = timers.get(uuid)
    if (timer === undefined) return
    clearTimeout(timer)
    timers.delete(uuid)
}
