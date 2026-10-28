/**
 * 422 de «alojamiento o propiedad inactivos» (contrato 2026-10-27). Lo usan el
 * panel (crear o mover reservas, reenviar el link, activar alojamientos,
 * despachar) y el portal del huésped (todas sus acciones).
 *
 * Se decide por `code`, nunca por el texto: el `message` llega traducido según
 * `X-Locale` y se muestra tal cual. `PROPERTY_INACTIVE` tiene precedencia en el
 * backend: si los dos están inactivos, llega ese.
 */

export const INACTIVE_RESOURCE_CODES = ["LISTING_INACTIVE", "PROPERTY_INACTIVE"] as const

export type InactiveResourceCode = (typeof INACTIVE_RESOURCE_CODES)[number]

export interface InactiveResourceError {
    code: InactiveResourceCode
    message: string
}

function isInactiveCode(value: unknown): value is InactiveResourceCode {
    return typeof value === "string" && (INACTIVE_RESOURCE_CODES as readonly string[]).includes(value)
}

/**
 * Sirve para el `ApiError` del panel y para el error del portal
 * (`CheckinApiError`): los dos llevan `status` y `code`. `null` = es otro error.
 */
export function readInactiveResourceError(error: unknown): InactiveResourceError | null {
    if (typeof error !== "object" || error === null) return null
    const candidate = error as { status?: unknown; code?: unknown; message?: unknown }
    if (candidate.status !== 422 || !isInactiveCode(candidate.code)) return null
    return {
        code: candidate.code,
        message: typeof candidate.message === "string" && candidate.message.trim() !== ""
            ? candidate.message
            : candidate.code === "PROPERTY_INACTIVE"
                ? "La propiedad está inactiva."
                : "El alojamiento está inactivo.",
    }
}

/**
 * El camino para resolverlo desde el panel: gestionar, nunca activar desde el
 * error. Activar una propiedad tiene efectos en cascada y pide su propia
 * confirmación. `null` si no se sabe a qué propiedad pertenece.
 */
export function inactiveResourceAction(
    error: InactiveResourceError,
    propertyUuid: string | null | undefined,
): { label: string; href: string } | null {
    if (!propertyUuid) return null
    return error.code === "PROPERTY_INACTIVE"
        ? { label: "Gestionar propiedad", href: `/dashboard/properties/${propertyUuid}` }
        : { label: "Gestionar alojamiento", href: `/dashboard/properties/${propertyUuid}?tab=units` }
}
