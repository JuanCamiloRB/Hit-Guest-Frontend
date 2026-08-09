import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
    getVerificationToken,
    getVerificationTokenState,
    setVerificationToken,
    clearVerificationToken,
} from "./verification-token"

const RES = "res-1"
const GUEST = "guest-1"
const KEY = `checkin-verification-token-${RES}-${GUEST}`

/** ISO a `min` minutos del ahora simulado (negativo = en el pasado). */
const inMinutes = (min: number) => new Date(Date.now() + min * 60_000).toISOString()

describe("verification-token", () => {
    beforeEach(() => {
        sessionStorage.clear()
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-08-07T12:00:00Z"))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe("ida y vuelta", () => {
        it("devuelve un token vigente", () => {
            setVerificationToken(RES, GUEST, "tok-abc", inMinutes(60))
            expect(getVerificationToken(RES, GUEST)).toBe("tok-abc")
            expect(getVerificationTokenState(RES, GUEST)).toBe("valid")
        })

        it("aísla a cada huésped de la misma reserva", () => {
            setVerificationToken(RES, GUEST, "tok-titular", inMinutes(60))
            setVerificationToken(RES, "guest-2", "tok-acompanante", inMinutes(60))
            expect(getVerificationToken(RES, GUEST)).toBe("tok-titular")
            expect(getVerificationToken(RES, "guest-2")).toBe("tok-acompanante")
        })

        it("sin token guardado no hay token ni estado", () => {
            expect(getVerificationToken(RES, GUEST)).toBeNull()
            expect(getVerificationTokenState(RES, GUEST)).toBe("absent")
        })

        it("clear borra el token", () => {
            setVerificationToken(RES, GUEST, "tok-abc", inMinutes(60))
            clearVerificationToken(RES, GUEST)
            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })
    })

    describe("vencimiento", () => {
        it("no entrega un token vencido", () => {
            setVerificationToken(RES, GUEST, "tok-abc", inMinutes(-1))
            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })

        it("lo entrega antes de vencer y deja de hacerlo después", () => {
            setVerificationToken(RES, GUEST, "tok-abc", inMinutes(60))
            expect(getVerificationToken(RES, GUEST)).toBe("tok-abc")

            vi.advanceTimersByTime(61 * 60_000)
            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })

        it("descarta el que vence dentro del margen, para que no muera en pleno viaje", () => {
            // Vence en 10s: alcanza para salir pero no para que vuelva la respuesta.
            setVerificationToken(RES, GUEST, "tok-abc", new Date(Date.now() + 10_000).toISOString())
            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })

        it("borra el token vencido en vez de dejar basura que solo genera 401s", () => {
            setVerificationToken(RES, GUEST, "tok-abc", inMinutes(-1))
            getVerificationToken(RES, GUEST)
            expect(sessionStorage.getItem(KEY)).toBeNull()
        })

        it("distingue 'expired' de 'absent' sin borrar nada", () => {
            setVerificationToken(RES, GUEST, "tok-abc", inMinutes(-1))

            expect(getVerificationTokenState(RES, GUEST)).toBe("expired")
            // De solo lectura: quien pregunta necesita saber que el token existió.
            expect(sessionStorage.getItem(KEY)).not.toBeNull()
            expect(getVerificationTokenState(RES, GUEST)).toBe("expired")
        })
    })

    describe("robustez del almacenamiento", () => {
        it("acepta el formato legacy (string pelado) sin expulsar al huésped", () => {
            // Un huésped a mitad del checkin cuando se despliega este cambio.
            sessionStorage.setItem(KEY, "tok-legacy")
            expect(getVerificationToken(RES, GUEST)).toBe("tok-legacy")
            expect(getVerificationTokenState(RES, GUEST)).toBe("valid")
        })

        it("trata una fecha ilegible como vigente en vez de romper el flujo", () => {
            sessionStorage.setItem(KEY, JSON.stringify({ token: "tok-abc", expiresAt: "no-es-fecha" }))
            expect(getVerificationToken(RES, GUEST)).toBe("tok-abc")
        })

        it("guardar sin expiresAt deja el token sin vencimiento", () => {
            setVerificationToken(RES, GUEST, "tok-abc")
            vi.advanceTimersByTime(24 * 60 * 60_000)
            expect(getVerificationToken(RES, GUEST)).toBe("tok-abc")
        })
    })
})
