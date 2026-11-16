import { describe, expect, it } from "vitest"
import {
    credentialsRejectionReason,
    formatRejectionSince,
    isCredentialsRejectedError,
    readCredentialsRejectedDispatchError,
    readCredentialsStatus,
} from "./credentials-rejection"

describe("readCredentialsStatus", () => {
    it("null o algo que no es objeto = sin pausa", () => {
        expect(readCredentialsStatus({ credentialsStatus: null })).toBeNull()
        expect(readCredentialsStatus({ credentialsStatus: "rejected" })).toBeNull()
        expect(readCredentialsStatus({ credentialsStatus: [] })).toBeNull()
    })

    it("sin el campo es «no se sabe» (undefined), no «sin pausa»: quien guarda conserva lo anterior", () => {
        expect(readCredentialsStatus({})).toBeUndefined()
        expect(readCredentialsStatus(null)).toBeUndefined()
    })

    it("lee la forma de la nota", () => {
        expect(readCredentialsStatus({
            credentialsStatus: {
                status: "rejected",
                reason: "token_rejected",
                providerMessage: "Token inválido.",
                since: "2026-11-11T08:15:02-05:00",
            },
        })).toEqual({
            status: "rejected",
            reason: "token_rejected",
            providerMessage: "Token inválido.",
            since: "2026-11-11T08:15:02-05:00",
        })
    })

    it("acepta snake_case y no se cae con campos raros: un objeto presente sigue siendo una pausa", () => {
        expect(readCredentialsStatus({ credentials_status: { provider_message: "HTTP 401", since: "no es fecha", reason: 3 } })).toEqual({
            status: "rejected",
            reason: null,
            providerMessage: "HTTP 401",
            since: null,
        })
    })
})

describe("textos", () => {
    it("traduce los cinco códigos y usa uno genérico para lo desconocido", () => {
        expect(credentialsRejectionReason("token_rejected")).toMatch(/Ministerio rechazó el token/)
        expect(credentialsRejectionReason("login_rejected")).toMatch(/usuario o la contraseña/)
        expect(credentialsRejectionReason("company_missing")).toMatch(/empresa/)
        expect(credentialsRejectionReason("account_rejected")).toMatch(/TTLock/)
        expect(credentialsRejectionReason("app_rejected")).toMatch(/client_secret/)
        expect(credentialsRejectionReason("nuevo_codigo")).toBe("El proveedor rechazó las credenciales.")
        expect(credentialsRejectionReason(null)).toBe("El proveedor rechazó las credenciales.")
    })

    it("formatea la fecha en hora de Colombia", () => {
        expect(formatRejectionSince("2026-11-11T13:15:02Z")).toMatch(/8:15/)
        expect(formatRejectionSince(null)).toBeNull()
    })
})

describe("señales por reserva y 422", () => {
    it("reconoce credentials_rejected como string o {message}", () => {
        expect(isCredentialsRejectedError("credentials_rejected")).toBe(true)
        expect(isCredentialsRejectedError({ message: "credentials_rejected" })).toBe(true)
        expect(isCredentialsRejectedError("credentials_missing")).toBe(false)
        expect(isCredentialsRejectedError(null)).toBe(false)
    })

    it("el 422 se decide por code, no por el texto", () => {
        expect(readCredentialsRejectedDispatchError({ status: 422, code: "CREDENTIALS_REJECTED", message: "En pausa." }))
            .toEqual({ message: "En pausa." })
        expect(readCredentialsRejectedDispatchError({ status: 422, code: "LISTING_INACTIVE", message: "x" })).toBeNull()
        expect(readCredentialsRejectedDispatchError({ status: 429, code: "CREDENTIALS_REJECTED" })).toBeNull()
        expect(readCredentialsRejectedDispatchError({ status: 422, code: "CREDENTIALS_REJECTED", message: "" })?.message)
            .toMatch(/rechazó las credenciales/)
    })
})
