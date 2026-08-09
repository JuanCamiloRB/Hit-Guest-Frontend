import { describe, it, expect } from "vitest"
import { isDocumentAlreadyVerified } from "./doc-verification"
import type { RegisteredGuest } from "../types/checkin"

type Guest = Pick<RegisteredGuest, "isCompleted" | "verification">

const guest = (over: Partial<Guest> = {}): Guest => ({
    isCompleted: false,
    ...over,
})

describe("isDocumentAlreadyVerified", () => {
    describe("estado del portal", () => {
        it("omite las fotos si el huésped ya completó el check-in", () => {
            expect(isDocumentAlreadyVerified(guest({ isCompleted: true }), false)).toBe(true)
        })

        it("omite las fotos con verificación aprobada o completada", () => {
            for (const status of ["approved", "completed"] as const) {
                expect(isDocumentAlreadyVerified(
                    guest({ verification: { status, currentStep: "form", verifiedAt: null } }),
                    false,
                )).toBe(true)
            }
        })

        it("omite las fotos cuando el backend ya movió al huésped al formulario", () => {
            expect(isDocumentAlreadyVerified(
                guest({ verification: { status: "pending", currentStep: "form", verifiedAt: null } }),
                false,
            )).toBe(true)
        })

        it("pide fotos a un huésped nuevo sin verificación", () => {
            expect(isDocumentAlreadyVerified(guest(), false)).toBe(false)
        })

        it("pide fotos mientras la verificación sigue en curso", () => {
            expect(isDocumentAlreadyVerified(
                guest({ verification: { status: "pending", currentStep: "verification", verifiedAt: null } }),
                false,
            )).toBe(false)
        })
    })

    describe("OTP del huésped recurrente (el caso reportado)", () => {
        it("NO pide fotos tras aprobar el OTP, aunque el portal siga en contact_challenge", () => {
            // Reproduce el reporte: el huésped recurrente recibió el código por
            // email, lo verificó, y el portal todavía no movió su currentStep.
            const stillPending = guest({
                verification: {
                    status: "contact_challenge_pending",
                    currentStep: "contact_challenge",
                    verifiedAt: null,
                },
            })

            expect(isDocumentAlreadyVerified(stillPending, false)).toBe(false)
            expect(isDocumentAlreadyVerified(stillPending, true)).toBe(true)
        })

        it("NO pide fotos tras aprobar el OTP aunque la llamada al portal haya fallado", () => {
            // getPortal() rechazó → no hay huésped que mirar. El token del OTP
            // sigue siendo prueba válida de que el backend mandó al formulario.
            expect(isDocumentAlreadyVerified(undefined, true)).toBe(true)
        })

        it("sí pide fotos si no hay token y el portal no dice nada", () => {
            expect(isDocumentAlreadyVerified(undefined, false)).toBe(false)
        })
    })
})
