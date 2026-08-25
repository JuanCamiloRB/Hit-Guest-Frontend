import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
    getVerificationToken,
    touchVerificationToken,
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
        localStorage.clear()
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
            expect(localStorage.getItem(KEY)).not.toBeNull()
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

    /**
     * El bug del 2026-08-19: el huésped verificaba el OTP y el check-in no
     * avanzaba —«Preparando formulario…» + «Tu sesión de verificación expiró»—
     * en bucle.
     *
     * Si `/contact-challenges/{id}/verify` no devuelve `verificationToken`,
     * `JSON.stringify({token: undefined, …})` **omite la clave**, y el lector
     * anterior no encontraba un `token` string, así que caía al camino "legacy"
     * y devolvía **el JSON entero como si fuera el token**. Ese texto viajaba en
     * `X-Checkin-Verification-Token`, el backend lo rechazaba con 401, el
     * huésped volvía al OTP y se guardaba la misma basura otra vez. Y como se
     * guardaba sin `expiresAt`, se consideraba vigente para siempre.
     */
    describe("un token inservible nunca se guarda ni se entrega", () => {
        it("no guarda nada cuando el backend no devuelve el token", () => {
            const err = vi.spyOn(console, "error").mockImplementation(() => {})

            setVerificationToken(RES, GUEST, undefined as unknown as string, inMinutes(60))

            expect(sessionStorage.getItem(KEY)).toBeNull()
            expect(getVerificationToken(RES, GUEST)).toBeNull()
            // Silenciar esto dejaría el fallo de contrato invisible.
            expect(err).toHaveBeenCalled()
            err.mockRestore()
        })

        /**
         * Sin este `false`, la pantalla del OTP decía «Código verificado» y
         * mandaba al formulario, que rebotaba con 401 y lo traía de vuelta a
         * repetir un código que ya había funcionado: un bucle que el huésped no
         * podía romper. El valor de retorno es lo que permite cortarlo.
         */
        it("informa que NO guardó, para que nadie mande al huésped al paso siguiente", () => {
            vi.spyOn(console, "error").mockImplementation(() => {})

            expect(setVerificationToken(RES, GUEST, undefined as unknown as string, inMinutes(60)))
                .toBe(false)
            expect(setVerificationToken(RES, GUEST, "tok-ok", inMinutes(60))).toBe(true)
        })

        it("no guarda un token vacío ni uno de puros espacios", () => {
            vi.spyOn(console, "error").mockImplementation(() => {})
            setVerificationToken(RES, GUEST, "   ", inMinutes(60))
            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })

        it("borra al huésped un token previo si el nuevo llega inservible", () => {
            vi.spyOn(console, "error").mockImplementation(() => {})
            setVerificationToken(RES, GUEST, "tok-viejo", inMinutes(60))

            setVerificationToken(RES, GUEST, "" as string, inMinutes(60))

            // Conservar el anterior fingiría una verificación que no ocurrió.
            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })

        it("NO devuelve el JSON crudo como token cuando el objeto no trae uno", () => {
            // Exactamente lo que quedaba guardado con el bug.
            sessionStorage.setItem(KEY, JSON.stringify({ expiresAt: inMinutes(60) }))

            expect(getVerificationToken(RES, GUEST)).toBeNull()
            // Y se limpia sola: si no, el bucle se repite en cada intento.
            expect(sessionStorage.getItem(KEY)).toBeNull()
        })

        it("trata el guardado corrupto como 'absent', no como 'valid'", () => {
            sessionStorage.setItem(KEY, JSON.stringify({ expiresAt: inMinutes(60) }))
            // Reportarlo "valid" daba vía libre a una llamada condenada al 401.
            expect(getVerificationTokenState(RES, GUEST)).toBe("absent")
        })

        it("descarta un JSON roto en vez de mandarlo como credencial", () => {
            sessionStorage.setItem(KEY, '{"token":"tok-abc"')

            expect(getVerificationToken(RES, GUEST)).toBeNull()
        })

        it("sigue aceptando el legacy: solo lo que empieza por '{' se lee como objeto", () => {
            localStorage.setItem(KEY, "tok-legacy")
            expect(getVerificationToken(RES, GUEST)).toBe("tok-legacy")
        })
    })

    /**
     * El token vivía en `sessionStorage` y el resto del estado del check-in en
     * `localStorage`: dos vidas distintas para un mismo flujo. Una pestaña
     * descartada por iOS o el salto del navegador in-app a Safari conservaba la
     * sesión pero perdía la credencial → 401 → «tu sesión expiró» → OTP otra
     * vez. Al desplegar el cambio hay huéspedes a mitad del check-in con el
     * token en el sitio viejo; se migra al leer, no se los expulsa.
     */
    describe("migración desde sessionStorage", () => {
        it("encuentra el token guardado por el build anterior", () => {
            sessionStorage.setItem(KEY, JSON.stringify({ token: "tok-viejo", expiresAt: inMinutes(60) }))

            expect(getVerificationToken(RES, GUEST)).toBe("tok-viejo")
        })

        it("lo MUEVE: queda en localStorage y desaparece del sitio viejo", () => {
            sessionStorage.setItem(KEY, "tok-legacy")

            getVerificationToken(RES, GUEST)

            expect(localStorage.getItem(KEY)).toBe("tok-legacy")
            expect(sessionStorage.getItem(KEY)).toBeNull()
        })

        it("clear borra los DOS sitios: un token sin migrar no puede resucitar", () => {
            sessionStorage.setItem(KEY, "tok-legacy")
            localStorage.setItem(KEY, JSON.stringify({ token: "tok-nuevo", expiresAt: inMinutes(60) }))

            clearVerificationToken(RES, GUEST)

            expect(getVerificationToken(RES, GUEST)).toBeNull()
            expect(sessionStorage.getItem(KEY)).toBeNull()
        })

        it("el actual gana sobre el viejo si conviven", () => {
            sessionStorage.setItem(KEY, "tok-viejo")
            localStorage.setItem(KEY, JSON.stringify({ token: "tok-nuevo", expiresAt: inMinutes(60) }))

            expect(getVerificationToken(RES, GUEST)).toBe("tok-nuevo")
        })
    })
})

/**
 * TTL deslizante (contrato 2026-08-24): el backend renueva el token a 60 min
 * con cada request que pasa el gate, pero las respuestas gateadas no devuelven
 * el `expiresAt` nuevo — el cliente extiende su copia local por la MISMA
 * duración observada al guardar, y nunca inventa una.
 */
describe("TTL deslizante (2026-08-24)", () => {
    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-08-26T10:00:00Z"))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("touch extiende el vencimiento local por la ventana observada al guardar", () => {
        setVerificationToken(RES, GUEST, "tok-abc", inMinutes(60))

        // A los 45 min el huésped sigue trabajando: una llamada gateada toca el token.
        vi.setSystemTime(new Date(Date.now() + 45 * 60_000))
        touchVerificationToken(RES, GUEST)

        // A los 70 min del guardado original ya habría vencido sin el touch;
        // con la extensión (45 + 60 = 105) sigue vigente.
        vi.setSystemTime(new Date(Date.now() + 25 * 60_000))
        expect(getVerificationToken(RES, GUEST)).toBe("tok-abc")

        // Y la extensión no es infinita: pasada la ventana desde el último touch, muere.
        vi.setSystemTime(new Date(Date.now() + 40 * 60_000))
        expect(getVerificationToken(RES, GUEST)).toBeNull()
    })

    it("no extiende un token legacy sin ventana observada — nunca se inventa una duración", () => {
        localStorage.setItem(KEY, JSON.stringify({ token: "tok-legacy", expiresAt: inMinutes(10) }))
        touchVerificationToken(RES, GUEST)

        vi.setSystemTime(new Date(Date.now() + 11 * 60_000))
        expect(getVerificationToken(RES, GUEST)).toBeNull()
    })

    it("no resucita un token ya vencido", () => {
        setVerificationToken(RES, GUEST, "tok-abc", inMinutes(60))
        vi.setSystemTime(new Date(Date.now() + 61 * 60_000))
        touchVerificationToken(RES, GUEST)
        expect(getVerificationToken(RES, GUEST)).toBeNull()
    })
})
