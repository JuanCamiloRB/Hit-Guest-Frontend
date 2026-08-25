import { describe, it, expect } from "vitest"
import { isDocumentAlreadyVerified, resolvePreFormVerificationStep } from "./doc-verification"
import type { GuestVerificationInfo, RegisteredGuest } from "../types/checkin"

type Guest = Pick<RegisteredGuest, "isCompleted" | "verification">

const guest = (over: Partial<Guest> = {}): Guest => ({
    isCompleted: false,
    ...over,
})

const verification = (
    over: Pick<GuestVerificationInfo, "status" | "currentStep"> & Partial<GuestVerificationInfo>,
): GuestVerificationInfo => ({
    verifiedAt: null,
    sessionType: null,
    startedAt: null,
    expiresAt: null,
    isStale: false,
    verificationUrl: null,
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
                    guest({ verification: verification({ status, currentStep: "form" }) }),
                    false,
                )).toBe(true)
            }
        })

        it("omite las fotos cuando el backend ya movió al huésped al formulario", () => {
            expect(isDocumentAlreadyVerified(
                guest({ verification: verification({ status: "pending", currentStep: "form" }) }),
                false,
            )).toBe(true)
        })

        it("pide fotos a un huésped nuevo sin verificación", () => {
            expect(isDocumentAlreadyVerified(guest(), false)).toBe(false)
        })

        it("pide fotos mientras la verificación sigue en curso", () => {
            expect(isDocumentAlreadyVerified(
                guest({ verification: verification({ status: "pending", currentStep: "verification" }) }),
                false,
            )).toBe(false)
        })

        it("omite las fotos cuando verify/result ya confirmó éxito aunque el portal siga pending", () => {
            const stalePortalGuest = guest({
                verification: verification({ status: "pending", currentStep: "verification" }),
            })

            expect(isDocumentAlreadyVerified(
                stalePortalGuest,
                false,
                { status: "verified" },
            )).toBe(true)
        })

        it("no convierte un resultado pending en éxito", () => {
            expect(isDocumentAlreadyVerified(
                guest(),
                false,
                { status: "pending" },
            )).toBe(false)
        })

        it("contact_challenge prevalece sobre una proyección stale de approved/form", () => {
            const stalePortalGuest = guest({
                verification: verification({ status: "approved", currentStep: "form" }),
            })

            expect(isDocumentAlreadyVerified(
                stalePortalGuest,
                false,
                { status: "contact_challenge" },
            )).toBe(false)
        })
    })

    describe("OTP del huésped recurrente (el caso reportado)", () => {
        it("NO pide fotos tras aprobar el OTP, aunque el portal siga en contact_challenge", () => {
            // Reproduce el reporte: el huésped recurrente recibió el código por
            // email, lo verificó, y el portal todavía no movió su currentStep.
            const stillPending = guest({
                verification: verification({
                    status: "contact_challenge_pending",
                    currentStep: "contact_challenge",
                }),
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

describe("resolvePreFormVerificationStep", () => {
    it("permite el formulario únicamente tras éxito confirmado", () => {
        expect(resolvePreFormVerificationStep({
            identityVerified: true,
            resultStatus: "verified",
            directiveType: "session",
        })).toBe("form")
    })

    it("mantiene un Didit pendiente en verify y no lo degrada a carga de documentos del formulario", () => {
        expect(resolvePreFormVerificationStep({
            identityVerified: false,
            resultStatus: "pending",
            directiveType: "session",
        })).toBe("verify")
    })

    it("conserva las otras ramas que decidió el backend", () => {
        expect(resolvePreFormVerificationStep({
            identityVerified: false,
            resultStatus: "contact_challenge",
            directiveType: "contact_challenge",
        })).toBe("contact_challenge")
        expect(resolvePreFormVerificationStep({ identityVerified: false })).toBe("identify")
    })

    it("prioriza el desafío de contacto y el cierre del portal sobre estados stale de éxito", () => {
        expect(resolvePreFormVerificationStep({
            identityVerified: true,
            resultStatus: "contact_challenge",
        })).toBe("contact_challenge")
        expect(resolvePreFormVerificationStep({
            identityVerified: true,
            portalStatus: "cancelled",
        })).toBe("home")
    })

    it("acepta el token emitido después del OTP aunque las proyecciones sigan en challenge", () => {
        expect(resolvePreFormVerificationStep({
            identityVerified: true,
            resultStatus: "contact_challenge",
            contactChallengeSatisfied: true,
        })).toBe("form")
    })
})
