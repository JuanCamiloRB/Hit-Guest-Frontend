import { describe, expect, it, vi } from "vitest"
import { ConcurrencyLimiter, settleWithConcurrency } from "./settle-with-concurrency"

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("settleWithConcurrency", () => {
    it("nunca corre más de `limit` tareas a la vez", async () => {
        let running = 0
        let peak = 0
        await settleWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 6, async (i) => {
            running += 1
            peak = Math.max(peak, running)
            await tick(i % 3)
            running -= 1
        })
        expect(peak).toBe(6)
    })

    it("conserva el orden original aunque terminen en otro orden", async () => {
        const results = await settleWithConcurrency([30, 0, 10], 3, async (ms) => {
            await tick(ms)
            return ms
        })
        expect(results).toEqual([
            { status: "fulfilled", value: 30 },
            { status: "fulfilled", value: 0 },
            { status: "fulfilled", value: 10 },
        ])
    })

    it("un fallo individual no detiene a los demás", async () => {
        const boom = new Error("boom")
        const results = await settleWithConcurrency([1, 2, 3, 4], 2, async (n) => {
            if (n === 2) throw boom
            return n * 10
        })
        expect(results).toEqual([
            { status: "fulfilled", value: 10 },
            { status: "rejected", reason: boom },
            { status: "fulfilled", value: 30 },
            { status: "fulfilled", value: 40 },
        ])
    })

    it("sin ítems no lanza ni crea workers inútiles", async () => {
        expect(await settleWithConcurrency([], 6, async () => 1)).toEqual([])
    })

    it("comparte el límite entre dos cargas simultáneas", async () => {
        const limiter = new ConcurrencyLimiter(6)
        let running = 0
        let peak = 0
        const task = async () => {
            running += 1
            peak = Math.max(peak, running)
            await tick(2)
            running -= 1
        }

        await Promise.all([
            settleWithConcurrency(Array.from({ length: 20 }), limiter, task),
            settleWithConcurrency(Array.from({ length: 20 }), limiter, task),
        ])
        expect(peak).toBe(6)
    })

    it("al abortar no despacha las tareas que seguían en cola", async () => {
        const limiter = new ConcurrencyLimiter(6)
        const controller = new AbortController()
        let started = 0
        let release!: () => void
        const gate = new Promise<void>((resolve) => { release = resolve })

        const pending = settleWithConcurrency(Array.from({ length: 30 }), limiter, async () => {
            started += 1
            await gate
            return started
        }, controller.signal)

        await vi.waitFor(() => expect(started).toBe(6))
        controller.abort()
        release()
        const results = await pending

        expect(started).toBe(6)
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(6)
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(24)
    })

    it("onSettled avisa cada resultado al llegar, con su índice, sin esperar al resto", async () => {
        const seen: Array<[number, string]> = []
        const results = await settleWithConcurrency(
            [30, 5, 15],
            3,
            async (ms, index) => {
                await tick(ms)
                if (index === 2) throw new Error("falló")
                return `t${index}`
            },
            undefined,
            (index, result) => seen.push([index, result.status]),
        )
        expect(seen).toEqual([[1, "fulfilled"], [2, "rejected"], [0, "fulfilled"]])
        expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "rejected"])
    })
})
