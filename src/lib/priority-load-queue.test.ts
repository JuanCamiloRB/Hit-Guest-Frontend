import { describe, expect, it, vi } from "vitest"
import { PriorityLoadQueue } from "./priority-load-queue"

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((res) => { resolve = res })
    return { promise, resolve }
}

describe("PriorityLoadQueue", () => {
    it("lo pedido con prioridad sale antes que el relleno de fondo, sin pasar el límite", async () => {
        const started: string[] = []
        const gates = new Map<string, ReturnType<typeof deferred>>()
        const queue = new PriorityLoadQueue<string>(2, (id) => id, async (id) => {
            started.push(id)
            const gate = deferred()
            gates.set(id, gate)
            await gate.promise
        })

        queue.request(["a", "b", "c", "d"], false)
        await vi.waitFor(() => expect(started).toEqual(["a", "b"]))

        // Lo visible se adelanta a lo que todavía espera turno.
        queue.request(["z"], true)
        gates.get("a")!.resolve()
        await vi.waitFor(() => expect(started).toEqual(["a", "b", "z"]))

        gates.get("b")!.resolve()
        gates.get("z")!.resolve()
        await vi.waitFor(() => expect(started).toEqual(["a", "b", "z", "c", "d"]))
    })

    it("pedir con prioridad algo que ya esperaba al fondo lo adelanta (la lista se encola antes de verse)", async () => {
        const started: string[] = []
        const gate = deferred()
        const queue = new PriorityLoadQueue<string>(1, (id) => id, async (id) => {
            started.push(id)
            if (id === "a") await gate.promise
        })

        queue.request(["a", "b", "c", "d"], false)
        await vi.waitFor(() => expect(started).toEqual(["a"]))
        queue.request(["d", "c"], true)
        gate.resolve()

        await vi.waitFor(() => expect(started).toEqual(["a", "d", "c", "b"]))
    })

    it("no repite una clave pendiente o en vuelo, pero sí una ya terminada (refresco)", async () => {
        const started: string[] = []
        const queue = new PriorityLoadQueue<string>(1, (id) => id, async (id) => {
            started.push(id)
        })

        queue.request(["a", "a", "b"], false)
        queue.request(["b", "a"], true)
        await vi.waitFor(() => expect(started).toEqual(["a", "b"]))

        queue.request(["a"], false)
        await vi.waitFor(() => expect(started).toEqual(["a", "b", "a"]))
    })

    it("un fallo de una tarea no detiene la cola", async () => {
        const started: string[] = []
        const queue = new PriorityLoadQueue<string>(1, (id) => id, async (id) => {
            started.push(id)
            if (id === "a") throw new Error("boom")
        })

        queue.request(["a", "b"], false)
        await vi.waitFor(() => expect(started).toEqual(["a", "b"]))
    })

    it("dispose aborta lo en vuelo, vacía lo pendiente e ignora pedidos nuevos", async () => {
        const started: string[] = []
        let seenSignal: AbortSignal | undefined
        const queue = new PriorityLoadQueue<string>(1, (id) => id, async (id, signal) => {
            started.push(id)
            seenSignal = signal
            await new Promise<void>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)))
        })

        queue.request(["a", "b"], false)
        await vi.waitFor(() => expect(started).toEqual(["a"]))
        queue.dispose()
        expect(seenSignal?.aborted).toBe(true)

        queue.request(["c"], true)
        await new Promise((res) => setTimeout(res, 0))
        expect(started).toEqual(["a"])
    })

    it("withdraw retira solo lo pendiente de esas claves; lo en vuelo termina y lo demás sigue", async () => {
        const started: string[] = []
        const gates = new Map<string, ReturnType<typeof deferred>>()
        const queue = new PriorityLoadQueue<string>(2, (id) => id, async (id) => {
            started.push(id)
            const gate = deferred()
            gates.set(id, gate)
            await gate.promise
        })

        queue.request(["a", "b", "c", "d", "e"], false)
        await vi.waitFor(() => expect(started).toEqual(["a", "b"]))
        queue.withdraw(["a", "c", "d"])
        gates.get("a")!.resolve()
        gates.get("b")!.resolve()
        await vi.waitFor(() => expect(started).toEqual(["a", "b", "e"]))

        // Retirada, la clave se puede volver a pedir.
        queue.request(["c"], true)
        gates.get("e")!.resolve()
        await vi.waitFor(() => expect(started).toEqual(["a", "b", "e", "c"]))
    })
})
