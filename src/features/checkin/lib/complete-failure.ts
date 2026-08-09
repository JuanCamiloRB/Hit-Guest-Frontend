/**
 * Clasifica por qué falló el envío final del check-in (`/main/sign`,
 * `/main/complete`, `/secondary/{uuid}/complete`).
 *
 * Importa porque la reacción es distinta en cada caso, y el criterio vivía como
 * simple ORDEN DE SENTENCIAS dentro de un `catch` largo: quien reordenara esos
 * `if` cambiaba el comportamiento sin darse cuenta. Acá el orden es explícito y
 * está cubierto por tests.
 *
 *  - `signature`            → problema del contrato, no de identidad. Se muestra
 *                             tal cual; esperar no arregla nada.
 *  - `main_guest_pending`   → el acompañante llegó antes que el titular. Comparte
 *                             el 403 con el caso de identidad pero NO se resuelve
 *                             igual: no hay nada que esperar ni que reverificar,
 *                             depende de otra persona. Mandarlo a rehacer su
 *                             verificación (o a esperar un webhook) es enviarlo a
 *                             un paso que no puede resolver.
 *  - `identity_unconfirmed` → el backend no da por confirmada la identidad.
 *                             PUEDE ser cuestión de tiempo (el webhook de Didit
 *                             todavía no llegó) o puede ser permanente
 *                             (documento vencido, huésped rechazado después de
 *                             haber sido verificado). Quién decide es el estado
 *                             del portal, no este clasificador.
 *  - `other`                → todo lo demás (garantía faltante, routing sin
 *                             configurar, validación…). Se muestra el mensaje
 *                             del backend.
 */

export type CompleteFailureKind =
    | "signature"
    | "main_guest_pending"
    | "identity_unconfirmed"
    | "other"

/**
 * El orden importa y es intencional: un 403/422 que habla de la firma se
 * clasifica como `signature` ANTES de mirar el código de estado. Sin esa
 * precedencia, el 422 "A digital signature is required to complete the
 * check-in" caería en la rama de identidad y mandaría al huésped a esperar por
 * una verificación que ya estaba bien. Por lo mismo, el 403 del acompañante que
 * llega antes que el titular se resuelve por MENSAJE antes de mirar el estado:
 * §18 usa el mismo 403 para eso y para "identidad no verificada".
 */
export function classifyCompleteFailure(
    status: number | undefined,
    message: string,
): CompleteFailureKind {
    const msg = (message ?? "").toLowerCase()

    if (msg.includes("firma") || msg.includes("signature")) return "signature"

    if (
        msg.includes("main guest must complete")
        || msg.includes("huésped principal")
        || msg.includes("huesped principal")
        || msg.includes("titular debe")
    ) {
        return "main_guest_pending"
    }

    // El resto del 403 de estos endpoints es "no puedo confirmar la identidad"
    // (`hasValidIdentityVerification()`).
    if (status === 403) return "identity_unconfirmed"

    if (
        msg.includes("identity_not_verified")
        || msg.includes("not_verified")
        || msg.includes("not been verified")
    ) {
        return "identity_unconfirmed"
    }

    return "other"
}
