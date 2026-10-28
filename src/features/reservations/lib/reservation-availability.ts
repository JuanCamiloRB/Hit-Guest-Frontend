/**
 * Cuándo se puede operar una reserva según el estado de su alojamiento y su
 * propiedad (contrato 2026-10-27, §2.1). La regla depende de la OPERACIÓN, no
 * solo del estado:
 *
 *  - crear → la propiedad y el alojamiento, activos;
 *  - editar sin mover o cancelar → siempre (el GET→PUT con el mismo alojamiento
 *    y el mismo estado no cuenta como mover ni reactivar);
 *  - mover a otro alojamiento → el DESTINO, activo.
 *
 * El panel no tiene acciones de restaurar ni reactivar reservas, así que no se
 * modelan. Esto anticipa el resultado; la autoridad final es el 422 del backend
 * (`readInactiveResourceError`). Un estado desconocido bloquea: nunca se asume
 * activo.
 */

import type { RecordStatus } from "@/features/properties/lib/record-status"

export type BookingBlock = "property_inactive" | "listing_inactive" | "property_unknown" | "listing_unknown"

export const BOOKING_RULE = "Solo puedes crear reservas en propiedades y alojamientos activos."

export const NO_ACTIVE_PROPERTIES =
    "No hay propiedades activas disponibles. Activa una propiedad y al menos uno de sus alojamientos para crear una reserva."

export const NO_ACTIVE_LISTINGS = "Esta propiedad no tiene alojamientos activos. Activa uno para poder crear la reserva."

export const BOOKING_BLOCK_MESSAGES: Record<BookingBlock, string> = {
    property_inactive: "Esta propiedad está inactiva. Actívala en Propiedades para crear o mover reservas en ella.",
    listing_inactive: "Este alojamiento está inactivo. Actívalo en la propiedad para crear o mover reservas en él.",
    property_unknown: "No pudimos confirmar que esta propiedad esté activa. Recarga la página; si sigue igual, contacta a soporte.",
    listing_unknown: "No pudimos confirmar que este alojamiento esté activo. Recarga la página; si sigue igual, contacta a soporte.",
}

/** Etiqueta para una opción que no se puede elegir. */
export function statusTag(status: RecordStatus, feminine: boolean): string | null {
    if (status === "inactive") return feminine ? "Inactiva" : "Inactivo"
    if (status === "unknown") return "Estado sin confirmar"
    return null
}

/** `null` = operable. La propiedad manda: inactiva, ninguno de sus alojamientos sirve. */
export function bookingBlock(property: RecordStatus, listing: RecordStatus | null): BookingBlock | null {
    if (property === "inactive") return "property_inactive"
    if (property === "unknown") return "property_unknown"
    if (listing === "inactive") return "listing_inactive"
    if (listing === "unknown") return "listing_unknown"
    return null
}

export type ReservationOperation = "create" | "edit"

export type Operability =
    | { allowed: true }
    | { allowed: false; reason: BookingBlock; message: string }

/**
 * `propertyStatus` y `listingStatus` son los del alojamiento ELEGIDO en el
 * formulario: en una edición que mueve la reserva, el destino.
 */
export function reservationOperability(input: {
    operation: ReservationOperation
    propertyStatus: RecordStatus
    listingStatus: RecordStatus
    /** Solo en edición: la reserva pasa a otro alojamiento. */
    listingChanged?: boolean
}): Operability {
    if (input.operation === "edit" && !input.listingChanged) return { allowed: true }
    const block = bookingBlock(input.propertyStatus, input.listingStatus)
    return block ? { allowed: false, reason: block, message: BOOKING_BLOCK_MESSAGES[block] } : { allowed: true }
}
