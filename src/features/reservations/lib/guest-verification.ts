/**
 * Override del PM sobre la verificación de identidad — contrato 2026-09-08,
 * revisado 2026-09-15 (skill `hitguest-api-contracts` §2c-bis).
 *
 * Lectura del bloque `identityWaiver` y de las señales de `verification` que
 * publica `GET /reservations/{uuid}/guests`, más el árbol de decisión de §5
 * (qué acción se le ofrece al PM por cada huésped). Vive en `lib/` por el mismo
 * motivo que `identity-document.ts`: es la única lectura del contrato — sin
 * React y sin fetch — y el árbol de casos (completado × waiver × estado ×
 * dueño) es exactamente lo que hay que poder testear solo.
 *
 * Este módulo NO contiene texto de producto (el copy vive en
 * `components/identity-document-meta.ts` y en el componente de acciones).
 */

/**
 * Exoneración vigente. La PRESENCIA del bloque es la señal completa: al
 * revocar, el backend devuelve `null` (no existe `revokedAt` — se anunció en la
 * v1 del contrato y se eliminó el 2026-09-15; la consulta solo devuelve
 * exoneraciones activas). `reason` llega `null` para quien no es el dueño de la
 * cuenta: es el caso normal de `property_staff`, no un error.
 */
export interface IdentityWaiver {
    uuid: string
    reason: string | null
    grantedAt: string | null
    grantedBy: string | null
}

/**
 * Lo que el panel dice de la verificación de UN huésped (bloque `verification`,
 * §4.3 — mismo shape del portal, calculado por el mismo código del backend).
 *
 * `reported: false` = el bloque no vino (backend anterior al deploy del
 * contrato). Sin él no se ofrece ninguna acción: los botones nuevos solo tienen
 * sentido contra un backend que también tiene los endpoints nuevos.
 */
export interface GuestVerificationSignals {
    reported: boolean
    status: string | null
    currentStep: string | null
    isStale: boolean
    /** `null` = el backend no lo dijo. Para exonerar se exige `false` EXPLÍCITO. */
    canRetry: boolean | null
    attemptsRemaining: number | null
    failureReason: string | null
}

export const EMPTY_VERIFICATION_SIGNALS: GuestVerificationSignals = Object.freeze({
    reported: false,
    status: null,
    currentStep: null,
    isStale: false,
    canRetry: null,
    attemptsRemaining: null,
    failureReason: null,
})

function asRecord(raw: unknown): Record<string, unknown> | null {
    return raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null
}

function readText(raw: unknown): string | null {
    if (typeof raw !== "string") return null
    const trimmed = raw.trim()
    return trimmed === "" ? null : trimmed
}

/** Lee `identityWaiver` de una entrada cruda de huésped. `null` = sin exoneración. */
export function readIdentityWaiver(rawGuest: unknown): IdentityWaiver | null {
    const guest = asRecord(rawGuest)
    const waiver = asRecord(guest?.identityWaiver ?? guest?.identity_waiver)
    if (!waiver) return null
    const uuid = readText(waiver.uuid)
    // Un bloque sin uuid no es una exoneración utilizable (revocar necesita
    // identificar QUÉ se revoca del lado del backend vía la reserva+huésped,
    // pero sin uuid tampoco hay garantía de que el shape sea el del contrato).
    if (!uuid) return null
    return {
        uuid,
        reason: readText(waiver.reason),
        grantedAt: readText(waiver.grantedAt ?? waiver.granted_at),
        grantedBy: readText(waiver.grantedBy ?? waiver.granted_by),
    }
}

/** Lee el bloque `verification` (§4.3) de una entrada cruda de huésped. */
export function readGuestVerificationSignals(rawGuest: unknown): GuestVerificationSignals {
    const guest = asRecord(rawGuest)
    const verification = asRecord(guest?.verification)
    // El discriminador del contrato nuevo es el bloque con `status`: el
    // endpoint del panel nunca lo tuvo antes del 2026-09-15.
    if (!verification || typeof verification.status !== "string") {
        return EMPTY_VERIFICATION_SIGNALS
    }
    const attempts = verification.attemptsRemaining ?? verification.attempts_remaining
    const canRetry = verification.canRetry ?? verification.can_retry
    return {
        reported: true,
        status: readText(verification.status)?.toLowerCase() ?? null,
        currentStep: readText(verification.currentStep ?? verification.current_step)?.toLowerCase() ?? null,
        isStale: (verification.isStale ?? verification.is_stale) === true,
        canRetry: typeof canRetry === "boolean" ? canRetry : null,
        attemptsRemaining: typeof attempts === "number" && Number.isFinite(attempts) ? attempts : null,
        failureReason: readText(verification.failureReason ?? verification.failure_reason),
    }
}

export interface GuestVerificationActions {
    /** «Reiniciar verificación» — bajo riesgo, la ven PM y staff. */
    showReset: boolean
    /** «Exonerar» — solo el dueño, y solo en el caso que justifica todo: rechazado sin salida. */
    showWaive: boolean
    /** «Revocar» — solo el dueño, oculto si el huésped ya completó (QA 8). */
    showRevoke: boolean
}

const NO_ACTIONS: GuestVerificationActions = Object.freeze({
    showReset: false,
    showWaive: false,
    showRevoke: false,
})

/** Superó identidad o fue exonerado: no hay nada que desatascar. */
const SETTLED_STATUSES = new Set(["approved", "verified", "completed", "waived"])

/**
 * Estados que describen un intento en curso: con `isStale` son el webhook
 * perdido (el atasco más común), sin él son espera legítima.
 */
const IN_FLIGHT_STATUSES = new Set(["pending", "in_progress", "resubmitted"])

/**
 * Familia de rechazo. `currentStep: "rejected"` la marca de forma genérica
 * (contrato 2026-09-02: `in_review` y `abandoned` llegan así), y los estados se
 * listan además por si un backend viejo mandara el bloque sin `currentStep`.
 */
const FAILED_STATUSES = new Set(["rejected", "fail", "expired", "ocr_rejected", "abandoned", "in_review"])

/**
 * Árbol de decisión de §5, en el mismo orden del contrato.
 *
 * Dos decisiones fail-closed deliberadas:
 * - Sin bloque `verification` (backend anterior) no se ofrece nada — los
 *   endpoints de reset/waiver tampoco existirían.
 * - «Exonerar» exige `canRetry: false` EXPLÍCITO. Es la única acción que mete a
 *   una persona sin verificar en un reporte a Migración; ante un backend que no
 *   dijo si el huésped puede salir solo, no se ofrece.
 */
export function resolveGuestVerificationActions(input: {
    isCompleted: boolean
    waiver: IdentityWaiver | null
    signals: GuestVerificationSignals
    isOwner: boolean
}): GuestVerificationActions {
    const { isCompleted, waiver, signals, isOwner } = input

    // Completado: nada que desatascar, y revocar reescribiría TRA/SIRE y
    // contratos ya firmados — la acción se OCULTA, no solo se maneja el 422.
    if (isCompleted) return NO_ACTIONS

    if (waiver) {
        return { showReset: false, showWaive: false, showRevoke: isOwner }
    }

    if (!signals.reported || !signals.status) return NO_ACTIONS
    if (SETTLED_STATUSES.has(signals.status)) return NO_ACTIONS

    if (IN_FLIGHT_STATUSES.has(signals.status) && signals.isStale) {
        return { showReset: true, showWaive: false, showRevoke: false }
    }

    if (signals.currentStep === "rejected" || FAILED_STATUSES.has(signals.status)) {
        return {
            showReset: true,
            showWaive: isOwner && signals.canRetry === false,
            showRevoke: false,
        }
    }

    return NO_ACTIONS
}

/**
 * Validación en cliente del motivo de la exoneración (regla del backend:
 * obligatorio, 10–1000 caracteres, no solo espacios) — para no gastar el 422.
 */
export function waiverReasonError(reason: string): string | null {
    const trimmed = reason.trim()
    if (trimmed.length < 10) return "El motivo debe tener al menos 10 caracteres."
    if (trimmed.length > 1000) return "El motivo no puede superar los 1000 caracteres."
    return null
}
