interface QueuedTask<R> {
    run: () => Promise<R>
    resolve: (value: R) => void
    reject: (reason: unknown) => void
    signal?: AbortSignal
}

function abortReason(signal?: AbortSignal): unknown {
    return signal?.reason ?? new DOMException("La carga fue cancelada", "AbortError")
}

/** Limitador reutilizable para respetar el máximo entre varias cargas. */
export class ConcurrencyLimiter {
    private active = 0
    private readonly queue: QueuedTask<unknown>[] = []

    constructor(private readonly limit: number) {
        if (!Number.isInteger(limit) || limit < 1) {
            throw new RangeError("El límite de concurrencia debe ser un entero positivo")
        }
    }

    run<R>(task: () => Promise<R>, signal?: AbortSignal): Promise<R> {
        if (signal?.aborted) return Promise.reject(abortReason(signal))

        return new Promise<R>((resolve, reject) => {
            const queued: QueuedTask<R> = { run: task, resolve, reject, signal }
            this.queue.push(queued as QueuedTask<unknown>)
            this.pump()
        })
    }

    private pump(): void {
        while (this.active < this.limit && this.queue.length > 0) {
            const queued = this.queue.shift()!
            if (queued.signal?.aborted) {
                queued.reject(abortReason(queued.signal))
                continue
            }

            this.active += 1
            Promise.resolve()
                .then(queued.run)
                .then(queued.resolve, queued.reject)
                .finally(() => {
                    this.active -= 1
                    this.pump()
                })
        }
    }
}

/**
 * `Promise.allSettled` ordenado, con limitador local o compartido.
 *
 * `onSettled` avisa de cada resultado en cuanto llega (en orden de llegada,
 * no de índice): sirve para pintar progresivamente sin esperar al último.
 */
export async function settleWithConcurrency<T, R>(
    items: readonly T[],
    limiterOrLimit: ConcurrencyLimiter | number,
    task: (item: T, index: number) => Promise<R>,
    signal?: AbortSignal,
    onSettled?: (index: number, result: PromiseSettledResult<R>) => void,
): Promise<PromiseSettledResult<R>[]> {
    const limiter = typeof limiterOrLimit === "number"
        ? new ConcurrencyLimiter(limiterOrLimit)
        : limiterOrLimit

    return Promise.all(items.map((item, index) =>
        limiter.run(() => task(item, index), signal).then(
            (value): PromiseFulfilledResult<R> => ({ status: "fulfilled", value }),
            (reason): PromiseRejectedResult => ({ status: "rejected", reason }),
        ).then((result) => {
            onSettled?.(index, result)
            return result
        }),
    ))
}
