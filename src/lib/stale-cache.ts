/**
 * Último valor bueno de una carga, compartido entre pantallas: quien vuelve
 * lo ve de inmediato mientras se refresca detrás. Un error nunca se guarda.
 *
 * - `load()`: SIEMPRE pide al servidor; solo comparte la petición que ya
 *   esté en vuelo. El valor guardado es para pintar mientras tanto, no para
 *   ahorrarse la consulta.
 * - `refresh()`: pide de nuevo aunque haya una en vuelo, y esa anterior deja
 *   de contar (empezó antes del cambio que motiva el refresco): su resultado
 *   llega a quien la pidió, pero no se guarda.
 * - `patch()`: ajusta el valor en el acto (quitar una fila borrada) sin
 *   esperar al servidor.
 * - `subscribe()` + `read()`: para `useSyncExternalStore`.
 *
 * Sin React ni fetch: solo ordena quién ve qué y cuándo. No se segmenta por
 * cuenta porque todo cambio de cuenta recarga el documento (support-session).
 */
export interface StaleCache<T> {
    read(): T | null
    load(): Promise<T>
    refresh(): Promise<T>
    patch(update: (value: T) => T): void
    subscribe(listener: () => void): () => void
    /** Solo para tests: vuelve al estado inicial. */
    reset(): void
}

export function createStaleCache<T>(fetcher: () => Promise<T>): StaleCache<T> {
    let value: T | null = null
    // La petición vigente. Una que ya no es esta no escribe aunque resuelva.
    let inflight: Promise<T> | null = null
    const listeners = new Set<() => void>()

    const notify = () => listeners.forEach((listener) => listener())

    const start = (): Promise<T> => {
        const request: Promise<T> = fetcher().then((result) => {
            if (inflight === request) {
                value = result
                notify()
            }
            return result
        }).finally(() => {
            if (inflight === request) inflight = null
        })
        inflight = request
        return request
    }

    return {
        read: () => value,
        load: () => inflight ?? start(),
        refresh: () => start(),
        patch(update) {
            if (value === null) return
            value = update(value)
            notify()
        },
        subscribe(listener) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        reset() {
            inflight = null
            value = null
        },
    }
}
