import type { CheckinPortalResponse } from "../types/checkin"

/**
 * A dónde mandar a un huésped que vuelve a `/identify` con `?guest_uuid=` (los
 * enlaces «Continuar» del hub). Ya pasó por la identificación: rehacerla lo
 * devolvía al formulario inicial y, con el OTP pendiente, lo dejaba frente a un
 * `/form` que exige un token que todavía no tiene.
 *
 * Vive acá porque las DOS rutas del portal (por UUID y externa
 * `/{source}/{listing}/{externalId}`) la necesitan: estaba escrita solo en la
 * de UUID y la externa caía siempre al formulario.
 *
 * `null` = no hay nada que reanudar (sin portal o sin `guest_uuid`): se muestra
 * la identificación.
 */
export function resolveIdentifyResume(
    portal: Pick<CheckinPortalResponse, "registeredGuests"> | null,
    guestUuid: string | undefined,
    basePath: string,
): string | null {
    if (!portal || !guestUuid) return null
    const guest = portal.registeredGuests?.find((g) => g.uuid === guestUuid)
    const currentStep = guest?.verification?.currentStep
    const query = `guest_uuid=${encodeURIComponent(guestUuid)}`

    if (currentStep === "verification") return `${basePath}/verify?${query}`
    // Recurrente con el OTP enviado y sin resolver: no puede caer al formulario.
    if (currentStep === "contact_challenge") return `${basePath}/contact-challenge?${query}`
    // "form", "completed" o sin paso → al formulario de datos.
    return `${basePath}/guest?${query}`
}
