import { afterEach, describe, expect, it, vi } from "vitest"
import {
    RATE_LIMIT_DEFAULT_MS,
    RateLimitedError,
    isRateLimitError,
    isRateLimited,
    noteRateLimited,
    rateLimitedUntil,
    resetRateLimit,
    throwIfRateLimited,
} from "./rate-limit"

describe("rate-limit — freno compartido tras un 429", () => {
    afterEach(() => {
        resetRateLimit()
        vi.useRealTimers()
    })

    it("sin 429 no frena nada", () => {
        expect(isRateLimited()).toBe(false)
        expect(rateLimitedUntil()).toBe(0)
        expect(() => throwIfRateLimited()).not.toThrow()
    })

    it("un 429 sin Retry-After frena un minuto; con Retry-After, lo que diga", () => {
        vi.useFakeTimers()
        noteRateLimited(null)
        expect(isRateLimited()).toBe(true)
        expect(rateLimitedUntil() - Date.now()).toBe(RATE_LIMIT_DEFAULT_MS)
        noteRateLimited(90)
        expect(rateLimitedUntil() - Date.now()).toBe(90_000)
        vi.advanceTimersByTime(90_000)
        expect(isRateLimited()).toBe(false)
    })

    it("un 429 más corto que el freno vigente no lo acorta", () => {
        vi.useFakeTimers()
        noteRateLimited(90)
        noteRateLimited(5)
        expect(rateLimitedUntil() - Date.now()).toBe(90_000)
    })

    it("throwIfRateLimited corta en el acto con un error reconocible como 429", () => {
        noteRateLimited(30)
        expect(() => throwIfRateLimited()).toThrow(RateLimitedError)
        try {
            throwIfRateLimited()
        } catch (error) {
            expect(isRateLimitError(error)).toBe(true)
            expect((error as RateLimitedError).status).toBe(429)
        }
    })

    it("isRateLimitError reconoce un ApiError con status 429 y nada más", () => {
        expect(isRateLimitError({ status: 429 })).toBe(true)
        expect(isRateLimitError({ status: 500 })).toBe(false)
        expect(isRateLimitError(new Error("x"))).toBe(false)
        expect(isRateLimitError(null)).toBe(false)
    })
})
