/**
 * Cola de cargas por elemento con prioridad: lo que se ve primero, el resto
 * de fondo; nunca más de `limit` en vuelo y nunca la misma clave dos veces
 * mientras esté pendiente o en vuelo. Pensada para «una petición por fila»
 * (el semáforo de Operaciones): la lista llega rápido y cada fila se completa
 * cuando le toca.
 *
 * Qué hacer con el resultado o con el fallo de cada `task` lo decide quien
 * la crea; la cola solo ordena y limita.
 */
export class PriorityLoadQueue<T> {
    private readonly pending: T[] = []
    private readonly queued = new Set<string>()
    private readonly inFlight = new Set<string>()
    private active = 0
    private readonly controller = new AbortController()

    constructor(
        private readonly limit: number,
        private readonly keyOf: (item: T) => string,
        private readonly task: (item: T, signal: AbortSignal) => Promise<void>,
    ) {
        if (!Number.isInteger(limit) || limit < 1) {
            throw new RangeError("El límite de concurrencia debe ser un entero positivo")
        }
    }

    /**
     * `front` = adelante de todo (filas visibles): también adelanta lo que ya
     * esperaba turno al fondo. Sin `front`, al final (relleno de fondo). Lo que
     * está en vuelo no se toca.
     */
    request(items: readonly T[], front: boolean): void {
        if (this.controller.signal.aborted) return
        const batch: T[] = []
        const batchKeys = new Set<string>()
        for (const item of items) {
            const key = this.keyOf(item)
            if (this.inFlight.has(key) || batchKeys.has(key)) continue
            if (this.queued.has(key) && !front) continue
            batchKeys.add(key)
            this.queued.add(key)
            batch.push(item)
        }
        if (front) {
            const rest = this.pending.filter((item) => !batchKeys.has(this.keyOf(item)))
            this.pending.length = 0
            this.pending.push(...batch, ...rest)
        } else {
            this.pending.push(...batch)
        }
        this.pump()
    }

    /**
     * Retira de la espera estas claves (una carga que ya nadie necesita). Lo
     * que está en vuelo no se toca: termina y su resultado vale.
     */
    withdraw(keys: Iterable<string>): void {
        const drop = new Set(keys)
        const keep = this.pending.filter((item) => !drop.has(this.keyOf(item)))
        this.pending.length = 0
        this.pending.push(...keep)
        for (const key of drop) this.queued.delete(key)
    }

    /** Cancela lo pendiente y lo que está en vuelo (desmontaje). */
    dispose(): void {
        this.controller.abort()
        this.pending.length = 0
        this.queued.clear()
    }

    private pump(): void {
        while (this.active < this.limit && this.pending.length > 0) {
            const item = this.pending.shift()!
            const key = this.keyOf(item)
            this.queued.delete(key)
            this.inFlight.add(key)
            this.active += 1
            Promise.resolve()
                .then(() => this.task(item, this.controller.signal))
                .catch(() => {
                    // El `task` ya decidió qué hacer con su fallo; la cola sigue.
                })
                .finally(() => {
                    this.inFlight.delete(key)
                    this.active -= 1
                    this.pump()
                })
        }
    }
}
