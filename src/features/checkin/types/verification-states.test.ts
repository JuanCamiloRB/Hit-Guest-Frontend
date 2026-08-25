import { describe, it, expect } from "vitest"
import { isSelfRecoverableVerification, type GuestVerificationInfo } from "./checkin"
import { isDocumentAlreadyVerified } from "../lib/doc-verification"

/**
 * Los 15 estados que el backend puede emitir hoy (§A del documento de endpoints).
 * El front declaraba 10; estos tests fijan los 5 que faltaban y, sobre todo, las
 * trampas de cada uno.
 */
const TODOS_LOS_ESTADOS: GuestVerificationInfo["status"][] = [
    "not_started", "pending", "in_progress", "resubmitted", "in_review",
    "approved", "rejected", "fail", "expired", "completed",
    "contact_challenge_pending", "pass", "kyc_session_failed", "superseded", "ocr_rejected",
]

const guest = (
    v: Pick<GuestVerificationInfo, "status" | "currentStep"> & Partial<GuestVerificationInfo>,
) => ({
    isCompleted: false,
    verification: {
        verifiedAt: null,
        sessionType: null,
        startedAt: null,
        expiresAt: null,
        isStale: false,
        verificationUrl: null,
        ...v,
    } as GuestVerificationInfo,
})

describe("estados de verificación del backend", () => {
    it("el tipo cubre los 15 estados que el backend emite", () => {
        expect(new Set(TODOS_LOS_ESTADOS).size).toBe(15)
    })

    describe("'pass' — la trampa: aprobado en biometría pero NO verificado", () => {
        it("no cuenta como verificado: llega con currentStep 'verification', no 'form'", () => {
            // Tratarlo como éxito manda al formulario a alguien a quien
            // /main/complete rechaza con 403 "identity has not been verified".
            expect(isDocumentAlreadyVerified(
                guest({ status: "pass", currentStep: "verification", verifiedAt: null }),
                false,
            )).toBe(false)
        })

        it("sí cuenta cuando el backend ya lo movió al formulario", () => {
            expect(isDocumentAlreadyVerified(
                guest({ status: "pass", currentStep: "form", verifiedAt: null }),
                false,
            )).toBe(true)
        })
    })

    describe("estados de los que el huésped puede salir solo", () => {
        it("kyc_session_failed y ocr_rejected son recuperables", () => {
            expect(isSelfRecoverableVerification("kyc_session_failed")).toBe(true)
            expect(isSelfRecoverableVerification("ocr_rejected")).toBe(true)
        })

        it("un rechazo real de Didit NO es recuperable por el huésped", () => {
            for (const status of ["rejected", "fail", "expired"]) {
                expect(isSelfRecoverableVerification(status)).toBe(false)
            }
        })

        it("los estados en curso tampoco son 'recuperables' — solo hay que seguir esperando", () => {
            for (const status of ["pending", "in_progress", "resubmitted", "in_review", "pass"]) {
                expect(isSelfRecoverableVerification(status)).toBe(false)
            }
        })
    })

    describe("ninguno de los estados nuevos se cuela como verificado", () => {
        it("kyc_session_failed, superseded y ocr_rejected no eximen de las fotos", () => {
            const enCurso = ["kyc_session_failed", "superseded"] as const
            for (const status of enCurso) {
                expect(isDocumentAlreadyVerified(
                    guest({ status, currentStep: "verification", verifiedAt: null }),
                    false,
                )).toBe(false)
            }
            expect(isDocumentAlreadyVerified(
                guest({ status: "ocr_rejected", currentStep: "rejected", verifiedAt: null }),
                false,
            )).toBe(false)
        })
    })

    describe("inconsistencia deliberada del backend (reserva forzada a completada)", () => {
        it("tolera isCompleted:true junto a un verification.status que no es 'completed'", () => {
            // status_reservation_id === 30 pisa isCompleted sin tocar verification.
            expect(isDocumentAlreadyVerified(
                { ...guest({ status: "approved", currentStep: "form" }), isCompleted: true },
                false,
            )).toBe(true)
        })
    })
})
