"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { clearVerificationToken } from "@/features/checkin/lib/verification-token"

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
 */
export function useVerificationRecovery(reservationUuid: string, basePath: string) {
    const router = useRouter()

    return useCallback(
        (guestUuid: string) => {
            clearVerificationToken(reservationUuid, guestUuid)
            toast.info("Tu sesión de verificación expiró. Verifica el código nuevamente.")
            router.push(`${basePath}/identify?guest_uuid=${guestUuid}`)
        },
        [reservationUuid, basePath, router],
    )
}
