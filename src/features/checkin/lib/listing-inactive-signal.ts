/**
 * Aviso central de «alojamiento o propiedad inactivos» en el portal (contrato
 * 2026-10-27, §2.3). Las acciones del huésped (identify, OTP, Didit,
 * formulario, firma, garantía, completes) responden 422 con ese `code`, y el
 * portal tiene unos 35 `catch` repartidos. En vez de tocar cada uno, el
 * servicio emite este evento al construir el error y `ListingInactiveBoundary`
 * (en el layout del portal) reemplaza la pantalla. Cubre también rutas que no
 * releen el portal en el servidor, como el callback de Didit.
 */

import { readInactiveResourceError, type InactiveResourceError } from "@/lib/inactive-resource"

export const LISTING_INACTIVE_EVENT = "hitguest:portal-listing-inactive"

/** Emite el aviso si `error` es el 422 de inactivo. Devuelve si lo era. */
export function signalIfListingInactive(error: unknown): boolean {
    const inactive = readInactiveResourceError(error)
    if (!inactive) return false
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent<InactiveResourceError>(LISTING_INACTIVE_EVENT, { detail: inactive }))
    }
    return true
}
