import { describe, it, expect } from "vitest"
import {
    EMPTY_VERIFICATION_SIGNALS,
    readGuestVerificationSignals,
    readIdentityWaiver,
    resolveGuestVerificationActions,
    waiverReasonError,
    type GuestVerificationSignals,
    type IdentityWaiver,
} from "./guest-verification"

/**
 * Los escenarios del `describe` del árbol replican la tabla de QA del contrato
 * 2026-09-08/15 (§8): cada caso cita su número.
 */

const waiver: IdentityWaiver = {
    uuid: "01a08214-x",
    reason: "Documento ilegible para ambos proveedores; identidad confirmada en persona.",
    grantedAt: "2026-09-08T20:14:33.000000Z",
    grantedBy: "Ricardo Lombana",
}

function signals(over: Partial<GuestVerificationSignals> = {}): GuestVerificationSignals {
    return { ...EMPTY_VERIFICATION_SIGNALS, reported: true, ...over }
}

describe("readIdentityWaiver", () => {
    it("lee el bloque del contrato y conserva reason null (caso normal de staff, QA 9)", () => {
        const parsed = readIdentityWaiver({
            identityWaiver: { uuid: "w-1", status: "active", reason: null, grantedAt: "2026-09-08T20:14:33Z", grantedBy: "Dueño" },
        })
        expect(parsed).toEqual({ uuid: "w-1", reason: null, grantedAt: "2026-09-08T20:14:33Z", grantedBy: "Dueño" })
    })

    it("null cuando no hay exoneración — y también con backend anterior sin la clave", () => {
        expect(readIdentityWaiver({ identityWaiver: null })).toBeNull()
        expect(readIdentityWaiver({})).toBeNull()
        expect(readIdentityWaiver(undefined)).toBeNull()
    })

    it("un bloque sin uuid no es una exoneración utilizable", () => {
        expect(readIdentityWaiver({ identityWaiver: { reason: "x" } })).toBeNull()
    })
})

describe("readGuestVerificationSignals", () => {
    it("sin bloque `verification` reporta reported: false (backend anterior)", () => {
        expect(readGuestVerificationSignals({})).toEqual(EMPTY_VERIFICATION_SIGNALS)
        expect(readGuestVerificationSignals(undefined)).toEqual(EMPTY_VERIFICATION_SIGNALS)
    })

    it("lee el shape del contrato (§4.3, el mismo del portal)", () => {
        expect(readGuestVerificationSignals({
            verification: {
                status: "rejected",
                currentStep: "rejected",
                isStale: false,
                canRetry: false,
                attemptsRemaining: 0,
                failureReason: "document_unreadable",
            },
        })).toEqual({
            reported: true,
            status: "rejected",
            currentStep: "rejected",
            isStale: false,
            canRetry: false,
            attemptsRemaining: 0,
            failureReason: "document_unreadable",
        })
    })

    it("canRetry no booleano queda en null: exonerar exigirá el false explícito", () => {
        const parsed = readGuestVerificationSignals({
            verification: { status: "rejected", canRetry: "no" },
        })
        expect(parsed.canRetry).toBeNull()
    })
})

describe("resolveGuestVerificationActions — árbol §5", () => {
    it("completado: nada que hacer, ni siquiera revocar (QA 8: la acción se oculta)", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: true,
            waiver,
            signals: signals({ status: "rejected", canRetry: false }),
            isOwner: true,
        })).toEqual({ showReset: false, showWaive: false, showRevoke: false })
    })

    it("exoneración activa: solo Revocar, y solo para el dueño", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false, waiver, signals: signals({ status: "waived" }), isOwner: true,
        })).toEqual({ showReset: false, showWaive: false, showRevoke: true })
        expect(resolveGuestVerificationActions({
            isCompleted: false, waiver, signals: signals({ status: "waived" }), isOwner: false,
        })).toEqual({ showReset: false, showWaive: false, showRevoke: false })
    })

    it("pending + isStale (webhook perdido): Reiniciar, para cualquiera (QA 2)", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false,
            waiver: null,
            signals: signals({ status: "pending", isStale: true }),
            isOwner: false,
        })).toEqual({ showReset: true, showWaive: false, showRevoke: false })
    })

    it("pending SIN isStale es espera legítima: nada", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false,
            waiver: null,
            signals: signals({ status: "pending", isStale: false }),
            isOwner: true,
        })).toEqual({ showReset: false, showWaive: false, showRevoke: false })
    })

    it("rechazado sin intentos: Reiniciar y, solo el dueño, Exonerar — EL caso del contrato (QA 1/4)", () => {
        const rejected = signals({ status: "rejected", currentStep: "rejected", canRetry: false, attemptsRemaining: 0 })
        expect(resolveGuestVerificationActions({
            isCompleted: false, waiver: null, signals: rejected, isOwner: true,
        })).toEqual({ showReset: true, showWaive: true, showRevoke: false })
        // QA 4: staff nunca ve Exonerar (el 403 no debería poder ocurrir desde la UI).
        expect(resolveGuestVerificationActions({
            isCompleted: false, waiver: null, signals: rejected, isOwner: false,
        })).toEqual({ showReset: true, showWaive: false, showRevoke: false })
    })

    it("rechazado con canRetry true: Reiniciar opcional, sin Exonerar (el huésped puede solo)", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false,
            waiver: null,
            signals: signals({ status: "rejected", currentStep: "rejected", canRetry: true }),
            isOwner: true,
        })).toEqual({ showReset: true, showWaive: false, showRevoke: false })
    })

    it("canRetry ausente en un rechazo: Exonerar NO se ofrece (fail-closed)", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false,
            waiver: null,
            signals: signals({ status: "rejected", currentStep: "rejected", canRetry: null }),
            isOwner: true,
        })).toEqual({ showReset: true, showWaive: false, showRevoke: false })
    })

    it("in_review/abandoned llegan con currentStep rejected y entran a la familia de rechazo", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false,
            waiver: null,
            signals: signals({ status: "abandoned", currentStep: "rejected", canRetry: false }),
            isOwner: true,
        })).toEqual({ showReset: true, showWaive: true, showRevoke: false })
    })

    it("aprobado o exonerado sin bloque waiver: nada que desatascar", () => {
        for (const status of ["approved", "verified", "completed", "waived"]) {
            expect(resolveGuestVerificationActions({
                isCompleted: false, waiver: null, signals: signals({ status }), isOwner: true,
            })).toEqual({ showReset: false, showWaive: false, showRevoke: false })
        }
    })

    it("backend anterior (sin bloque verification): sin acciones — los endpoints tampoco existirían", () => {
        expect(resolveGuestVerificationActions({
            isCompleted: false,
            waiver: null,
            signals: EMPTY_VERIFICATION_SIGNALS,
            isOwner: true,
        })).toEqual({ showReset: false, showWaive: false, showRevoke: false })
    })
})

describe("waiverReasonError — la regla del backend, validada en cliente (QA 5)", () => {
    it("rechaza corto, solo espacios y de más de 1000; acepta el válido", () => {
        expect(waiverReasonError("abc")).not.toBeNull()
        expect(waiverReasonError("            ")).not.toBeNull()
        expect(waiverReasonError("a".repeat(1001))).not.toBeNull()
        expect(waiverReasonError("Documento ilegible; identidad confirmada en persona.")).toBeNull()
    })
})
