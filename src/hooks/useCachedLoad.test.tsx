import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createStaleCache } from "@/lib/stale-cache"
import { useCachedLoad } from "./useCachedLoad"

class NotReady extends Error {}
const isRetryable = (error: unknown) => error instanceof NotReady
const OPTIONS = { isRetryable, retries: 2, retryMs: 1000 }

describe("useCachedLoad — reintentos agotados", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("con datos previos, agotar el tope deja de «reintentar» y marca refreshFailed (hay botón); no se piden más", async () => {
        let notReady = false
        const fetcher = vi.fn(async () => {
            if (notReady) throw new NotReady("202")
            return ["a"]
        })
        const cache = createStaleCache(fetcher)
        const { result } = renderHook(() => useCachedLoad(cache, OPTIONS))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(result.current.status).toBe("ready")

        notReady = true
        act(() => result.current.refresh())
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(result.current.retrying).toBe(true)
        expect(result.current.refreshFailed).toBe(false)

        // Dos reintentos más (retries: 2) y se acabó.
        await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        const calls = fetcher.mock.calls.length
        expect(calls).toBe(4)
        expect(result.current.status).toBe("ready")
        expect(result.current.retrying).toBe(true)
        // Antes quedaba «sincronizando» para siempre sin aviso ni botón.
        expect(result.current.refreshFailed).toBe(true)
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(fetcher.mock.calls.length).toBe(calls)

        // Reintentar a mano vuelve a empezar la cuenta y, si ya está listo, limpia el aviso.
        notReady = false
        act(() => result.current.refresh())
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(result.current.refreshFailed).toBe(false)
        expect(result.current.retrying).toBe(false)
    })

    it("sin datos previos, agotar el tope es status error con retrying (el aviso de «sincronizando» con Reintentar)", async () => {
        const fetcher = vi.fn(async () => { throw new NotReady("202") })
        const cache = createStaleCache(fetcher)
        const { result } = renderHook(() => useCachedLoad(cache, OPTIONS))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        expect(fetcher).toHaveBeenCalledTimes(3)
        expect(result.current.status).toBe("error")
        expect(result.current.retrying).toBe(true)
        expect(result.current.refreshFailed).toBe(false)
    })
})
