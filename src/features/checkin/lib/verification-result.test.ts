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

        it("acepta estados de Didit sin depender de capitalización", () => {
            expect(normalizeVerificationResult(portal({ status: "Approved", currentStep: "Form" })))
                .toEqual({ status: "verified" })
        })

        it("acepta verified con capitalización distinta en la forma no legacy", () => {
            expect(normalizeVerificationResult(portal({ status: "VERIFIED", currentStep: "verification" })))
                .toEqual({ status: "verified" })
        })

        it("acepta el check-in ya completado", () => {
            expect(normalizeVerificationResult(portal({ status: "completed", currentStep: "completed" })))
                .toEqual({ status: "verified" })
        })
    })

    describe("escalada a KYC — la etapa manda, no 'pass'", () => {
        it("pending con sessionType kyc devuelve la sesión nueva", () => {
            expect(normalizeVerificationResult(portal({
                status: "pending",
                currentStep: "verification",
                sessionType: "kyc",
                verificationUrl: "https://verify.didit.me/session/nueva",
            }))).toEqual({ status: "kyc_required", kycUrl: "https://verify.didit.me/session/nueva" })
        })

        it("pass con URL pero sin sessionType kyc sigue esperando", () => {
            expect(normalizeVerificationResult(portal({
                status: "pass",
                currentStep: "verification",
                verificationUrl: "https://verify.didit.me/session/desconocida",
            }))).toEqual({ status: "pending" })
        })

        it("la URL biométrica nunca se confunde con una escalada", () => {
            expect(normalizeVerificationResult(portal({
                status: "pending",
                currentStep: "verification",
                sessionType: "biometric",
                verificationUrl: "https://verify.didit.me/session/biometrica",
            }))).toEqual({ status: "pending" })
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

    describe("espera huérfana", () => {
        it("respeta isStale como señal autoritativa del backend", () => {
            expect(normalizeVerificationResult(portal({
                status: "pending",
                currentStep: "verification",
                isStale: true,
            }))).toEqual({ status: "stale" })
        })

        it("no inventa un timeout cuando isStale es false", () => {
            expect(normalizeVerificationResult(portal({
                status: "pending",
                currentStep: "verification",
                isStale: false,
            }))).toEqual({ status: "pending" })
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
                .toEqual({ status: "failed", retryable: true, failureReason: "ocr_rejected" })
        })

        it.each(["rejected", "fail", "expired"])("'%s' de Didit es terminal", (status) => {
            expect(normalizeVerificationResult(portal({ status, currentStep: "rejected" })))
                .toEqual({ status: "failed", retryable: false, failureReason: status })
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

describe("contrato 2026-09-02: in_review y abandoned como fallos reintentables", () => {
    // Payloads REALES del documento de backend (§3), no escritos de memoria.
    it("in_review con foto borrosa llega como fallo reparable con su motivo e intentos", () => {
        const out = normalizeVerificationResult({
            verification: {
                status: "in_review",
                currentStep: "rejected",
                sessionType: "kyc",
                isStale: false,
                canRetry: true,
                attemptsRemaining: 2,
                failureReason: "document_image_quality",
                verificationUrl: "https://verify.didit.me/s/kyc",
            },
        })
        expect(out).toEqual({
            status: "failed",
            retryable: true,
            failureReason: "document_image_quality",
            attemptsRemaining: 2,
        })
    })

    it("abandoned es reintentable sin motivo estructurado (antes se colapsaba en rechazo permanente)", () => {
        const out = normalizeVerificationResult({
            verification: {
                status: "abandoned",
                currentStep: "rejected",
                canRetry: true,
                attemptsRemaining: 2,
                failureReason: null,
                verificationUrl: "https://verify.didit.me/s/bio",
            },
        })
        expect(out.status).toBe("failed")
        expect(out.retryable).toBe(true)
        // El null del backend NO se pasa como motivo: cae al legacy para que el
        // copy tenga siempre una llave.
        expect(out.failureReason).toBe("rejected")
    })

    it("canRetry: false es fallo definitivo aunque el motivo exista", () => {
        const out = normalizeVerificationResult({
            verification: { status: "rejected", currentStep: "rejected", canRetry: false, attemptsRemaining: 0 },
        })
        expect(out.retryable).toBe(false)
        expect(out.attemptsRemaining).toBe(0)
    })

    it("un backend ANTERIOR (sin canRetry) conserva el comportamiento previo", () => {
        // Orden de deploy: el doc dice backend primero, pero el front no puede
        // depender de eso — sin los campos nuevos, rejected sigue siendo terminal
        // y ocr_rejected sigue siendo reintentable.
        expect(normalizeVerificationResult({ verification: { currentStep: "rejected", status: "rejected" } }))
            .toMatchObject({ status: "failed", retryable: false, failureReason: "rejected" })
        expect(normalizeVerificationResult({ verification: { status: "ocr_rejected" } }))
            .toMatchObject({ status: "failed", retryable: true, failureReason: "ocr_rejected" })
    })

    it("pending con los campos nuevos sigue siendo pending: canRetry false no es un fallo", () => {
        expect(normalizeVerificationResult({
            verification: { status: "pending", currentStep: "verification", canRetry: false, attemptsRemaining: 3 },
        })).toEqual({ status: "pending" })
    })
})
