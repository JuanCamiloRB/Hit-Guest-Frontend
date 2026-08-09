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

import type { RegisteredGuest } from "../types/checkin"

/** Lo mínimo que se necesita de un huésped del portal — no el objeto entero. */
type VerifiableGuest = Pick<RegisteredGuest, "isCompleted" | "verification">

export function isDocumentAlreadyVerified(
    guest: VerifiableGuest | undefined,
    hasContactChallengeToken: boolean,
): boolean {
    // El OTP aprobado alcanza por sí solo: sobrevive tanto a que el portal no
    // haya avanzado el estado como a que el portal no responda.
    if (hasContactChallengeToken) return true
    if (!guest) return false

    const status = guest.verification?.status
    const currentStep = guest.verification?.currentStep

    return guest.isCompleted === true
        || status === "approved"
        || status === "completed"
        || currentStep === "form"
        || currentStep === "completed"
}
