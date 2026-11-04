import { describe, expect, it, vi } from "vitest"
import { createStaleCache } from "./stale-cache"

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

describe("createStaleCache", () => {
    it("load guarda el valor y avisa; dos load en vuelo comparten la petición", async () => {
        const pending = deferred<string[]>()
        const fetcher = vi.fn(() => pending.promise)
        const cache = createStaleCache(fetcher)
        const listener = vi.fn()
        cache.subscribe(listener)

        const a = cache.load()
        const b = cache.load()
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(cache.read()).toBeNull()

        pending.resolve(["x"])
        await expect(a).resolves.toEqual(["x"])
        await expect(b).resolves.toEqual(["x"])
        expect(cache.read()).toEqual(["x"])
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it("load con valor guardado vuelve a pedir: el valor es para pintar, no para ahorrarse la consulta", async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(["v1"]).mockResolvedValueOnce(["v2"])
        const cache = createStaleCache(fetcher)
        await cache.load()
        await cache.load()
        expect(fetcher).toHaveBeenCalledTimes(2)
        expect(cache.read()).toEqual(["v2"])
    })

    it("un error no se guarda, no borra lo anterior y libera el vuelo para la siguiente", async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(["x"]).mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(["y"])
        const cache = createStaleCache(fetcher)
        await cache.load()
        await expect(cache.refresh()).rejects.toThrow("503")
        expect(cache.read()).toEqual(["x"])
        await cache.load()
        expect(cache.read()).toEqual(["y"])
    })

    it("refresh conserva el valor y descarta lo que estaba en vuelo; load se suma al refresh en curso", async () => {
        const first = deferred<string[]>()
        const second = deferred<string[]>()
        const fetcher = vi.fn().mockResolvedValueOnce(["v1"]).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const cache = createStaleCache(fetcher)
        await cache.load()

        const stale = cache.refresh()
        const fresh = cache.refresh()
        const joined = cache.load()
        expect(fetcher).toHaveBeenCalledTimes(3)
        expect(cache.read()).toEqual(["v1"])

        second.resolve(["v3"])
        await fresh
        await joined
        first.resolve(["v2"])
        // Quien pidió la vieja recibe SU resultado, pero la caché no lo guarda.
        await expect(stale).resolves.toEqual(["v2"])
        expect(cache.read()).toEqual(["v3"])
    })

    it("reset descarta lo en vuelo", async () => {
        const pending = deferred<string[]>()
        const cache = createStaleCache(() => pending.promise)
        const request = cache.load()
        cache.reset()
        pending.resolve(["x"])
        await request
        expect(cache.read()).toBeNull()
    })

    it("patch ajusta el valor en el acto y avisa; sin valor no hace nada", async () => {
        const cache = createStaleCache(async () => ["a", "b"])
        const listener = vi.fn()
        cache.subscribe(listener)
        cache.patch((list) => list.filter((x) => x !== "a"))
        expect(listener).not.toHaveBeenCalled()

        await cache.load()
        cache.patch((list) => list.filter((x) => x !== "a"))
        expect(cache.read()).toEqual(["b"])
        expect(listener).toHaveBeenCalledTimes(2)
    })
})
