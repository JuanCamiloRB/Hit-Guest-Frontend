/**
 * Nombre del titular guardado en `extra` de la reserva.
 *
 * Histórico: el formulario de creación tenía UN campo ("Nombre completo del
 * huésped"), así que las reservas antiguas traen solo `extra.guest_name` con el
 * nombre entero. Ahora se guarda partido (`guest_name` + `guest_lastname`),
 * igual que el resto del modelo — `GuestProfile`, `RegisteredGuest`,
 * `IdentifyResponse.guest` y `ReservationGuest` siempre tuvieron nombre y
 * apellido separados; `extra` era la única excepción, y era una decisión del
 * frontend, no del backend.
 *
 * Estas funciones son el único sitio que conoce las dos formas, para que ni la
 * tabla ni el panel ni el diálogo de edición tengan que repetir el fallback.
 */

/** Lee un string no vacío de un campo de la API, o `undefined`. */
function readText(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined
    const trimmed = raw.trim()
    return trimmed === "" ? undefined : trimmed
}

export interface GuestNameParts {
    name?: string
    lastname?: string
}

/**
 * Lee nombre y apellido del `extra` de una reserva.
 *
 * Una reserva antigua devuelve solo `name` (con el nombre completo dentro) y
 * `lastname` indefinido. NO se parte por espacios: es indecidible en español
 * ("María González Pérez") y el dato alimenta reportes SIRE/TRA, donde un
 * apellido mal partido parece correcto y se envía igual.
 */
export function readGuestNameParts(extra: unknown): GuestNameParts {
    if (!extra || typeof extra !== "object") return {}
    const source = extra as Record<string, unknown>
    return {
        name: readText(source.guestName ?? source.guest_name),
        lastname: readText(source.guestLastname ?? source.guest_lastname),
    }
}

/**
 * El nombre para mostrar en una línea (tabla, panel, correos).
 *
 * Devuelve `undefined` cuando no hay nada, para que quien llama decida su
 * propio fallback en vez de recibir un string vacío que parece un nombre.
 */
export function composeGuestName(extra: unknown): string | undefined {
    const { name, lastname } = readGuestNameParts(extra)
    if (!name) return lastname
    return lastname ? `${name} ${lastname}` : name
}
