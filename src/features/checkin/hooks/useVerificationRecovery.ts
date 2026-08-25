"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    clearVerificationToken,
    getVerificationTokenState,
} from "@/features/checkin/lib/verification-token"

/**
 * Qué hacer cuando el backend rechaza el `verificationToken` (401) o cuando el
 * token ya venció del lado del cliente.
 *
 * Existe porque estas mismas tres líneas —borrar el token, avisar, mandar a
 * /identify— estaban copiadas en cinco lugares (`GuestFormScreen`,
 * `SecondaryGuestFormScreen` ×2, `ContractScreen`, y el `onSessionExpired` que
 * `ContractScreen` le pasa a `GuaranteeCardForm`). Copiadas ya habían empezado
 * a divergir: algunas borraban el token y otras no, con lo que el huésped
 * volvía a /identify arrastrando la credencial muerta que causó el rebote.
 *
 * Volver a /identify es a propósito y no pierde nada: re-enviar ese formulario
 * produce un `contact_challenge` nuevo, y los datos que el huésped ya tipeó
 * siguen en localStorage.
 *
 * ## Por qué el aviso depende del estado local y NO del texto del 401
 *
 * El contrato del gate publica **tres** condiciones bajo el mismo 401 (y dos de
 * ellas comparten literal): falta verificar el OTP · falta el header
 * `X-Checkin-Verification-Token` · token inválido o vencido. Decir siempre
 * «expiró» miente en dos de los tres casos.
 *
 * La causa se deduce de algo que el frontend sí sabe con certeza —qué
 * credencial tenía guardada al hacer la llamada—, nunca leyendo el `message`:
 * ese texto ya cambió antes en este backend y encadenar la recuperación a una
 * cadena de caracteres es exactamente el error que documenta la semántica
 * 401/403 del proyecto.
 */
export function useVerificationRecovery(reservationUuid: string, basePath: string) {
    const router = useRouter()

    return useCallback(
        (guestUuid: string, error?: unknown) => {
            // Desde el 2026-08-24 ambos 401 del gate traen `code`
            // (`CONTACT_CHALLENGE_REQUIRED` / `CONTACT_CHALLENGE_TOKEN_INVALID`):
            // esa es la autoridad. La deducción por estado local queda como
            // FALLBACK para llamadores sin error a mano (vencimiento local
            // preventivo, callbacks sin argumentos) y para un backend viejo.
            const code = error && typeof error === "object"
                && typeof (error as { code?: unknown }).code === "string"
                ? (error as { code: string }).code
                : null
            const state = getVerificationTokenState(reservationUuid, guestUuid)
            clearVerificationToken(reservationUuid, guestUuid)

            if (code === "CONTACT_CHALLENGE_TOKEN_INVALID") {
                // Con TTL deslizante, un token localmente "vigente" rechazado ya
                // no es una contradicción grave (el reloj local es un espejo
                // aproximado) — se registra como diagnóstico, no como error.
                if (state === "valid") {
                    console.warn(
                        "[verification] 401 TOKEN_INVALID sobre un token localmente vigente — "
                        + "esperable con TTL deslizante si la última extensión local fue optimista.",
                    )
                }
                // /identify retoma el challenge con `alreadyVerified` y SIN correo
                // nuevo: el huésped reingresa el código que ya tenía.
                toast.info("Tu sesión de verificación expiró. Reingresa el código que te enviamos.")
            } else if (code === "CONTACT_CHALLENGE_REQUIRED") {
                toast.info("Necesitas verificar el código que te enviamos para continuar.")
            } else if (state === "valid") {
                // Sin `code` y con token local vigente: backend viejo o un 401 de
                // otra naturaleza. Se mantiene la señal fuerte original.
                console.error(
                    "[verification] El backend rechazó (401) un verificationToken que el cliente "
                    + "tenía por vigente, sin `code` en el body. Revisar el token que emite "
                    + "/contact-challenges/{id}/verify.",
                )
                toast.error("No pudimos validar tu verificación. Intenta de nuevo o contacta al anfitrión.")
            } else if (state === "expired") {
                toast.info("Tu sesión de verificación expiró. Verifica el código nuevamente.")
            } else {
                // Nunca hubo token: el huésped no llegó a verificar el código, o
                // está en otro navegador/dispositivo que el del OTP. No es un
                // vencimiento y decírselo así lo manda a buscar un problema que no
                // tiene.
                toast.info("Necesitas verificar el código que te enviamos para continuar.")
            }

            router.push(`${basePath}/identify?guest_uuid=${guestUuid}`)
        },
        [reservationUuid, basePath, router],
    )
}
