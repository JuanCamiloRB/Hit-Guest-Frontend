import { describe, it, expect } from "vitest"
import { normalizeVerificationResult } from "./verification-result"

/** Atajo para armar la forma que devuelve `GET /verify/result` (§3). */
const portal = (verification: Record<string, unknown>) => ({ verification })

describe("normalizeVerificationResult — §A traducida a decisiones", () => {
    describe("verificado", () => {
        it("acepta currentStep 'form'", () => {
            expect(normalizeVerificationResult(portal({ status: "approved", currentStep: "form" })))
                .toEqual({ status: "verified" })
        })

        it("acepta el check-in ya completado", () => {
            expect(normalizeVerificationResult(portal({ status: "completed", currentStep: "completed" })))
                .toEqual({ status: "verified" })
        })
    })

    describe("'pass' — la trampa: biométrico aprobado que aún NO está verificado", () => {
        it("con sesión de documento pendiente, devuelve esa sesión para completarla", () => {
            expect(normalizeVerificationResult(portal({
                status: "pass",
                currentStep: "verification",
                verificationUrl: "https://verify.didit.me/session/nueva",
            }))).toEqual({ status: "kyc_required", kycUrl: "https://verify.didit.me/session/nueva" })
        })

        it("nunca se reporta como verificado — llega con currentStep 'verification'", () => {
            expect(normalizeVerificationResult(portal({ status: "pass", currentStep: "verification" })).status)
                .not.toBe("verified")
        })
    })

    describe("no reabrir una sesión ya consumida", () => {
        // Este es el bug que motivó separar `pass` del resto: la URL de un estado
        // en curso apunta a la sesión que el huésped YA está haciendo. Devolverla
        // como "kyc_required" hacía que el front la relanzara y Didit respondiera
        // 403 ("URL de verificación no válida"). En memoria había una referencia
        // que lo evitaba, pero se perdía con un simple reload.
        it.each(["pending", "in_progress", "in_review", "resubmitted"])(
            "'%s' con URL sigue siendo esperar, no relanzar",
            (status) => {
                expect(normalizeVerificationResult(portal({
                    status,
                    currentStep: "verification",
                    verificationUrl: "https://verify.didit.me/session/en-curso",
                }))).toEqual({ status: "pending" })
            },
        )
    })

    describe("kyc_session_failed — recuperable, pero NO por la URL", () => {
        it("pide reiniciar en vez de devolver una URL", () => {
            expect(normalizeVerificationResult(portal({ status: "kyc_session_failed", currentStep: "verification" })))
                .toEqual({ status: "restart_required" })
        })

        it("ignora la URL vieja del biométrico ya consumido", () => {
            // Si esta URL se devolviera como kyc_required, el front reabriría el
            // biométrico que el huésped ya pasó y Didit lo rechazaría con 403.
            const result = normalizeVerificationResult(portal({
                status: "kyc_session_failed",
                currentStep: "verification",
                verificationUrl: "https://verify.didit.me/session/consumida",
            }))
            expect(result).toEqual({ status: "restart_required" })
            expect(result).not.toHaveProperty("kycUrl")
        })
    })

    describe("contact_challenge — no avanza por sondeo", () => {
        it("lo detecta por status", () => {
            expect(normalizeVerificationResult(portal({ status: "contact_challenge_pending", currentStep: "contact_challenge" })))
                .toEqual({ status: "contact_challenge" })
        })

        it("lo detecta por currentStep aunque el status venga distinto", () => {
            expect(normalizeVerificationResult(portal({ status: "approved", currentStep: "contact_challenge" })))
                .toEqual({ status: "contact_challenge" })
        })
    })

    describe("rechazos — reintentable vs. terminal", () => {
        it("el rechazo de OCR se marca reintentable", () => {
            // El huésped puede volver a intentar de una con mejores fotos.
            // Tratarlo como terminal lo mandaba al anfitrión sin necesidad.
            expect(normalizeVerificationResult(portal({ status: "ocr_rejected", currentStep: "rejected" })))
                .toEqual({ status: "failed", retryable: true })
        })

        it.each(["rejected", "fail", "expired"])("'%s' de Didit es terminal", (status) => {
            expect(normalizeVerificationResult(portal({ status, currentStep: "rejected" })))
                .toEqual({ status: "failed", retryable: false })
        })
    })

    describe("tolerancia de formas", () => {
        it("respeta la forma plana legacy", () => {
            expect(normalizeVerificationResult({ status: "kyc_required", kycUrl: "https://x" }))
                .toEqual({ status: "kyc_required", kycUrl: "https://x" })
        })

        it("acepta el objeto de verificación sin envolver", () => {
            expect(normalizeVerificationResult({ status: "approved", currentStep: "form" }))
                .toEqual({ status: "verified" })
        })

        it("no revienta con una respuesta vacía o nula", () => {
            expect(normalizeVerificationResult({})).toEqual({ status: "pending" })
            expect(normalizeVerificationResult(null)).toEqual({ status: "pending" })
        })

        it("un estado sin empezar sigue siendo esperar", () => {
            expect(normalizeVerificationResult(portal({ status: "not_started", currentStep: "verification" })))
                .toEqual({ status: "pending" })
        })

        it("'superseded' no se cuela como verificado ni como fallo", () => {
            expect(normalizeVerificationResult(portal({ status: "superseded", currentStep: "verification" })))
                .toEqual({ status: "pending" })
        })
    })
})
