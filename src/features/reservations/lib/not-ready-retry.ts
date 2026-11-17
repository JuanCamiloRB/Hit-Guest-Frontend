import { ReservationsNotReadyError } from "../services/reservations-service"

/**
 * Espera `ms` o hasta que `signal` se cancele, lo que llegue primero. Cancelar
 * corta el temporizador en el acto (desmontar, «Reintentar», otra carga): no
 * se espera a que venza para enterarse.
 */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException("Cancelado", "AbortError"))
            return
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort)
            resolve()
        }, ms)
        function onAbort() {
            clearTimeout(timer)
            reject(signal?.reason ?? new DOMException("Cancelado", "AbortError"))
        }
        signal?.addEventListener("abort", onAbort, { once: true })
    })
}

export interface NotReadyRetryOptions {
    retries: number
    retryMs: number
    signal?: AbortSignal
    /** Cada 202: el error (con su `page`) y el intento que acaba de fallar (desde 0). */
    onNotReady?: (error: ReservationsNotReadyError, attempt: number) => void
}

/**
 * Pide la lista y, si el backend responde «todavía no» (202), la vuelve a
 * pedir ENTERA hasta `retries` veces más, esperando `retryMs` entre intentos.
 * Nunca una sola página: las reservas se mueven entre páginas mientras se
 * sincroniza. Cualquier otro error sale tal cual en el primer intento.
 */
export async function loadWhileNotReady<T>(load: () => Promise<T>, options: NotReadyRetryOptions): Promise<T> {
    const { retries, retryMs, signal, onNotReady } = options
    for (let attempt = 0; ; attempt++) {
        signal?.throwIfAborted()
        try {
            return await load()
        } catch (error) {
            if (!(error instanceof ReservationsNotReadyError)) throw error
            onNotReady?.(error, attempt)
            if (attempt >= retries) throw error
            await abortableDelay(retryMs, signal)
        }
    }
}
