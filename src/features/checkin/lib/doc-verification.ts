/**
 * ¿Se le pueden omitir a este huésped las fotos del documento en el formulario?
 *
 * La regla vivía duplicada, palabra por palabra, en `GuestFormScreen` y
 * `SecondaryGuestFormScreen`, y una tercera variante en `IdentifyScreen`
 * (`resumeExistingGuest`). Al estar copiada, arreglarla en un solo sitio dejaba
 * los otros con el bug — por eso vive aquí y se testea sola.
 *
 * Las dos fuentes son distintas a propósito:
 *
 *  1. `guest` — el estado que publica el portal. Es la fuente principal.
 *  2. `hasContactChallengeToken` — que el navegador tenga el `verificationToken`
 *     que emitió el backend al aprobar el OTP del huésped recurrente.
 *
 * La segunda existe porque la primera tiene un hueco real: un huésped
 * recurrente que acaba de pasar el OTP ya probó posesión del email histórico, y
 * el backend se lo confirmó respondiendo `nextStep: "form"`
 * (`VerifyContactChallengeResponse`). Si el portal todavía no movió su
 * `currentStep`, o si la llamada al portal falla, mirar solo el portal le pide
 * fotos del documento a alguien a quien el propio backend ya mandó al
 * formulario. Es exactamente el caso que se reportó: OTP correcto → fotos.
 *
 * Esto NO es "confiar en una bandera de localStorage" (lo que prohíbe
 * `docs/CHECKIN_VIDEO_AUDIT_2026-07-29.md`): el token es una credencial opaca
 * que solo emite el backend al verificar el código, y no es la frontera de
 * seguridad. Falsificarlo no sirve de nada — `/form`, `/sign`,
 * `/guarantee/setup-intent` y ambos `/complete` lo validan server-side y
 * responden 401, que ambas pantallas ya manejan mandando al huésped de vuelta a
 * verificar. Lo único que decide este valor es si se piden dos fotos de más.
 */

import type { RegisteredGuest, VerificationDirective, VerificationResultResponse } from "../types/checkin"

/** Lo mínimo que se necesita de un huésped del portal — no el objeto entero. */
type VerifiableGuest = Pick<RegisteredGuest, "isCompleted" | "verification">

export type PreFormVerificationStep = "home" | "form" | "contact_challenge" | "verify" | "identify"

/**
 * Guard shared by the main and secondary forms. It never chooses a provider:
 * `/identify` already did that. It only prevents the form from mounting before
 * the backend has reported a terminal verification state.
 */
export function resolvePreFormVerificationStep(input: {
    identityVerified: boolean
    resultStatus?: VerificationResultResponse["status"]
    directiveType?: VerificationDirective["type"]
    portalStatus?: "cancelled" | "deleted" | "pending_sync"
    /** True only when the backend-issued OTP verification token is present. */
    contactChallengeSatisfied?: boolean
}): PreFormVerificationStep {
    if (input.portalStatus) return "home"
    if (input.contactChallengeSatisfied) return "form"
    if (input.resultStatus === "contact_challenge" || input.directiveType === "contact_challenge") {
        return "contact_challenge"
    }
    if (input.identityVerified || input.directiveType === "verified_ok") return "form"
    return input.directiveType ? "verify" : "identify"
}

/**
 * Respaldo tras una subida de documento aceptada (200 de §17, OCR o captura).
 * La sesión de `/identify` sigue diciendo `document_upload`/`document_capture`
 * después del 200; si en el formulario fallan A LA VEZ el portal y
 * `/verify/result`, sin esto el guard devolvía al huésped a `/verify` a repetir
 * unas fotos que ya están en la reserva (y que ya no están en memoria).
 *
 * Solo cuenta cuando NINGUNA fuente del backend respondió: una observación real
 * siempre gana (un reset del PM después del 200 tiene que volver a pedir la
 * verificación). Mismo criterio que el token del OTP: lo emitió el backend, y
 * `/form`, `/sign` y `/complete` lo siguen validando server-side.
 */
export function acceptedUploadFallback(
    uploadOutcome: "verified" | "captured" | undefined,
    backendObserved: boolean,
): "verified" | "captured" | null {
    return !backendObserved && uploadOutcome ? uploadOutcome : null
}

export function isDocumentAlreadyVerified(
    guest: VerifiableGuest | undefined,
    hasContactChallengeToken: boolean,
    verificationResult?: Pick<VerificationResultResponse, "status"> | null,
): boolean {
    // El OTP aprobado alcanza por sí solo: sobrevive tanto a que el portal no
    // haya avanzado el estado como a que el portal no responda.
    if (hasContactChallengeToken) return true
    // The contact challenge is an explicit backend gate and has precedence over
    // stale approved/form projections. Only the token issued after OTP success
    // can move this guest past it.
    if (verificationResult?.status === "contact_challenge") return false
    if (guest?.verification?.status === "contact_challenge_pending"
        || guest?.verification?.currentStep === "contact_challenge") return false
    // The lightweight polling endpoint can expose Didit's terminal result before
    // the broader portal projection catches up. Both are backend observations.
    if (verificationResult?.status === "verified") return true
    if (!guest) return false

    const status = guest.verification?.status
    const currentStep = guest.verification?.currentStep

    return guest.isCompleted === true
        || status === "approved"
        || status === "completed"
        // Captura sin verificación (contrato 2026-09-27): las fotos ya están en
        // la reserva, el formulario no las vuelve a pedir.
        || status === "document_captured"
        || currentStep === "form"
        || currentStep === "completed"
}

/**
 * Qué le dice el formulario al huésped en el bloque de documento cuando NO va a
 * pedirle fotos. Tres motivos distintos y ninguno puede usar el copy del otro:
 * el verificado sí verificó; el exonerado no, y el contrato pide no decírselo
 * (el copy es neutro); el capturado solo subió fotos y tampoco verificó.
 *
 * Se miran las DOS fuentes (portal y `/verify/result`) por el mismo motivo que
 * `isDocumentAlreadyVerified`: cualquiera puede ir atrasada o caída.
 */
export type DocumentNotice = "verified" | "waived" | "captured"

export function documentNotice(
    guest: VerifiableGuest | undefined,
    verificationResult?: Pick<VerificationResultResponse, "waived" | "captured"> | null,
): DocumentNotice {
    if (guest?.verification?.status === "waived" || verificationResult?.waived === true) return "waived"
    if (guest?.verification?.status === "document_captured" || verificationResult?.captured === true) return "captured"
    return "verified"
}
