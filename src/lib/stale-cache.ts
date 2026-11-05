/**
 * Último valor bueno de una carga, compartido entre pantallas: quien vuelve
 * lo ve de inmediato mientras se refresca detrás. Un error nunca se guarda.
 *
 * - `load()`: SIEMPRE pide al servidor; solo comparte la petición que ya
 *   esté en vuelo. El valor guardado es para pintar mientras tanto, no para
 *   ahorrarse la consulta.
 * - `refresh()`: pide de nuevo y CANCELA la petición anterior (empezó antes
 *   del cambio que motiva el refresco). Si la anterior falla por eso (o por
 *   cualquier otra cosa), quien la esperaba recibe el resultado de la nueva.
 * - `invalidate()`: olvida el valor y cancela lo en vuelo. Para cuando una
 *   mutación dejó el valor guardado en un estado que se sabe incorrecto: la
 *   próxima pantalla arranca limpia en vez de mostrarlo. SOLO sin pantallas
 *   montadas sobre la caché (la mutación ocurre en otra ruta): una montada
 *   quedaría sin valor y sin carga, que se lee como error. Con una montada,
 *   `refresh()`.
 * - `patch()`: ajusta el valor en el acto (quitar una fila borrada) sin
 *   esperar al servidor.
 * - `subscribe()` + `read()`: para `useSyncExternalStore`. Quien se suscribe
 *   cuenta como consumidor: cuando no queda ninguno, lo en vuelo se cancela
 *   (nadie va a mostrarlo) y el último valor se conserva. Si el fetcher
 *   ignora la señal y la respuesta llega igual, se guarda: no se tira trabajo
 *   ya hecho (p. ej. una precarga de la ficha).
 *
 * Sin React ni fetch: solo ordena quién ve qué y cuándo. No se segmenta por
 * cuenta porque todo cambio de cuenta recarga el documento (support-session).
 */
export interface StaleCache<T> {
    read(): T | null
    load(): Promise<T>
    refresh(): Promise<T>
    invalidate(): void
    patch(update: (value: T) => T): void
    subscribe(listener: () => void): () => void
    /** Solo para tests: vuelve al estado inicial. */
    reset(): void
}

export function createStaleCache<T>(fetcher: (signal: AbortSignal) => Promise<T>): StaleCache<T> {
    let value: T | null = null
    // La petición vigente y su cancelación. Una que ya no es esta no escribe.
    let inflight: Promise<T> | null = null
    let controller: AbortController | null = null
    // La última petición iniciada; a diferencia de `inflight`, no se borra al
    // terminar: quien esperaba una reemplazada puede seguirla aunque ya haya
    // resuelto. Solo una cancelación de verdad (`stop`) la olvida.
    let latest: Promise<T> | null = null
    // La que quedó sin consumidores: si igual llega, su resultado vale.
    let orphan: Promise<T> | null = null
    const listeners = new Set<() => void>()

    const notify = () => listeners.forEach((listener) => listener())

    const stop = () => {
        controller?.abort()
        controller = null
        inflight = null
        latest = null
        orphan = null
    }

    // Quien esperaba una petición que fue reemplazada (o cancelada por el
    // reemplazo) sigue a la vigente en vez de recibir su error.
    const follow = (request: Promise<T>): Promise<T> =>
        request.catch((error: unknown) => {
            if (latest && latest !== request) return follow(latest)
            throw error
        })

    const start = (): Promise<T> => {
        // La anterior quedó reemplazada: se corta su red, no solo su resultado.
        controller?.abort()
        orphan = null
        const own = new AbortController()
        controller = own
        const request: Promise<T> = fetcher(own.signal).then((result) => {
            if (inflight === request || orphan === request) {
                value = result
                orphan = null
                notify()
            }
            return result
        }).finally(() => {
            if (inflight === request) {
                inflight = null
                controller = null
            }
        })
        inflight = request
        latest = request
        return follow(request)
    }

    return {
        read: () => value,
        load: () => (inflight ? follow(inflight) : start()),
        refresh: () => start(),
        invalidate() {
            stop()
            if (value === null) return
            value = null
            notify()
        },
        patch(update) {
            if (value === null) return
            value = update(value)
            notify()
        },
        subscribe(listener) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
                if (listeners.size > 0) return
                // Un tick de gracia: cambiar de pestaña desmonta una pantalla y
                // monta otra sobre la misma caché en el mismo render.
                setTimeout(() => {
                    if (listeners.size > 0 || !inflight) return
                    const abandoned = inflight
                    stop()
                    orphan = abandoned
                }, 0)
            }
        },
        reset() {
            stop()
            value = null
        },
    }
}
