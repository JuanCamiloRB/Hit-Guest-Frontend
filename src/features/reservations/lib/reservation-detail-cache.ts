import { createStaleCache, type StaleCache } from "@/lib/stale-cache"
import { reservationsService, type ReservationDetailData } from "../services/reservations-service"

/** Fichas recordadas a la vez; al pasar el tope se olvida la más antigua. */
export const MAX_CACHED_DETAILS = 20

const caches = new Map<string, StaleCache<ReservationDetailData>>()

/**
 * La caché de UNA ficha, por uuid. Se crea la primera vez que se pide y el
 * mapa conserva el orden de creación: al pasar el tope sale la más antigua.
 * Leer no muta nada (se llama en render).
 */
export function detailCacheFor(uuid: string): StaleCache<ReservationDetailData> {
    const existing = caches.get(uuid)
    if (existing) return existing
    const cache = createStaleCache(() => reservationsService.getById(uuid))
    caches.set(uuid, cache)
    if (caches.size > MAX_CACHED_DETAILS) {
        const oldest = caches.keys().next().value
        if (oldest !== undefined) caches.delete(oldest)
    }
    return cache
}

/** Solo para tests. */
export function resetReservationDetailCache(): void {
    caches.clear()
}

/**
 * Precarga la ficha (p. ej. al pasar el cursor por la fila). Una que ya está
 * en caché o en vuelo no se vuelve a pedir (al abrirla se revalida igual);
 * un fallo se ignora: al abrir la ficha se intenta otra vez y ahí sí se dice.
 */
export function prefetchReservationDetail(uuid: string): void {
    const cache = detailCacheFor(uuid)
    if (cache.read() !== null) return
    cache.load().catch(() => {})
}
