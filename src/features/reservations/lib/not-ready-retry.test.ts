import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ReservationsNotReadyError } from "../services/reservations-service"
import { abortableDelay, loadWhileNotReady } from "./not-ready-retry"

const notReady = (page?: number) => new ReservationsNotReadyError({ message: "sync" }, page)

describe("loadWhileNotReady — un 202 repite la LISTA COMPLETA, con espera cancelable", () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it("intento inicial + hasta 3 reintentos; se recupera en el segundo intento", async () => {
        const load = vi.fn().mockRejectedValueOnce(notReady(2)).mockResolvedValueOnce(["ok"])
        const onNotReady = vi.fn()
        const promise = loadWhileNotReady(load, { retries: 3, retryMs: 2500, onNotReady })
        await vi.advanceTimersByTimeAsync(2500)
        await expect(promise).resolves.toEqual(["ok"])
        expect(load).toHaveBeenCalledTimes(2)
        expect(onNotReady).toHaveBeenCalledTimes(1)
        expect(onNotReady.mock.calls[0][0].page).toBe(2)
        expect(onNotReady.mock.calls[0][1]).toBe(0)
    })

    it("se recupera en el cuarto intento (el último permitido)", async () => {
        const load = vi.fn()
            .mockRejectedValueOnce(notReady()).mockRejectedValueOnce(notReady()).mockRejectedValueOnce(notReady())
            .mockResolvedValueOnce(["ok"])
        const promise = loadWhileNotReady(load, { retries: 3, retryMs: 2500 })
        await vi.advanceTimersByTimeAsync(2500 * 3)
        await expect(promise).resolves.toEqual(["ok"])
        expect(load).toHaveBeenCalledTimes(4)
    })

    it("agotados los reintentos, sale el último 202 (con su página) y no se pide más", async () => {
        const load = vi.fn().mockRejectedValue(notReady(3))
        const onNotReady = vi.fn()
        const promise = loadWhileNotReady(load, { retries: 3, retryMs: 2500, onNotReady })
        const settled = promise.catch((error: unknown) => error)
        await vi.advanceTimersByTimeAsync(2500 * 10)
        const error = await settled
        expect(error).toBeInstanceOf(ReservationsNotReadyError)
        expect((error as ReservationsNotReadyError).page).toBe(3)
        expect(load).toHaveBeenCalledTimes(4)
        expect(onNotReady).toHaveBeenCalledTimes(4)
        expect(onNotReady.mock.calls[3][1]).toBe(3)
    })

    it("cualquier otro error sale en el acto, sin reintentar", async () => {
        const load = vi.fn().mockRejectedValue(new Error("network down"))
        await expect(loadWhileNotReady(load, { retries: 3, retryMs: 2500 })).rejects.toThrow("network down")
        expect(load).toHaveBeenCalledTimes(1)
    })

    it("cancelar durante la espera la corta en el acto: ni se agota el temporizador ni se vuelve a pedir", async () => {
        const controller = new AbortController()
        const load = vi.fn().mockRejectedValue(notReady())
        const promise = loadWhileNotReady(load, { retries: 3, retryMs: 2500, signal: controller.signal })
        const settled = promise.catch((error: unknown) => error)
        await vi.advanceTimersByTimeAsync(100)
        controller.abort()
        const error = await settled
        expect((error as { name?: string }).name).toBe("AbortError")
        expect(vi.getTimerCount()).toBe(0)
        await vi.advanceTimersByTimeAsync(2500 * 4)
        expect(load).toHaveBeenCalledTimes(1)
    })

    it("abortableDelay: ya cancelada no espera nada; cancelada a mitad, rechaza sin dejar temporizador", async () => {
        const done = new AbortController()
        done.abort()
        await expect(abortableDelay(1000, done.signal)).rejects.toMatchObject({ name: "AbortError" })
        const mid = new AbortController()
        const pending = abortableDelay(1000, mid.signal).catch((error: unknown) => error)
        mid.abort()
        expect(await pending).toMatchObject({ name: "AbortError" })
        expect(vi.getTimerCount()).toBe(0)
    })
})
