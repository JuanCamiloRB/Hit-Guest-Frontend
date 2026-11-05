/**
 * Borrador del formulario de check-in en este dispositivo, UNO POR HUÉSPED.
 *
 * Antes la clave era solo por reserva (`checkin-guest-form-{reserva}`): el
 * titular y sus acompañantes que hacían el check-in por el enlace directo en
 * el mismo dispositivo compartían borrador, y el segundo abría el formulario
 * con los datos del primero (nombre, documento, correo).
 *
 * Migración: un borrador viejo solo se adopta cuando el backend (o la sesión
 * de /identify) confirma que este huésped es el TITULAR, y nunca se copia a un
 * acompañante. Adoptado, o terminado el check-in del titular, se borra.
 */
export function guestFormDraftKey(reservationUuid: string, guestUuid: string): string {
    return `checkin-guest-form-${reservationUuid}-${guestUuid}`
}

const legacyKey = (reservationUuid: string) => `checkin-guest-form-${reservationUuid}`

/**
 * Pasa el borrador viejo de la reserva al del titular y lo borra. Llamar SOLO
 * con el titular confirmado. Si el titular ya tiene borrador propio, manda el
 * suyo (es más reciente) y el viejo solo se borra. Devuelve lo adoptado.
 */
export function adoptLegacyGuestFormDraft(reservationUuid: string, mainGuestUuid: string): Record<string, unknown> | null {
    try {
        const raw = localStorage.getItem(legacyKey(reservationUuid))
        if (raw === null) return null
        localStorage.removeItem(legacyKey(reservationUuid))
        if (localStorage.getItem(guestFormDraftKey(reservationUuid, mainGuestUuid)) !== null) return null
        const draft: unknown = JSON.parse(raw)
        if (typeof draft !== "object" || draft === null || Array.isArray(draft)) return null
        localStorage.setItem(guestFormDraftKey(reservationUuid, mainGuestUuid), raw)
        return draft as Record<string, unknown>
    } catch {
        return null
    }
}

/** Al terminar el titular: el borrador viejo ya no le sirve a nadie. */
export function dropLegacyGuestFormDraft(reservationUuid: string): void {
    try {
        localStorage.removeItem(legacyKey(reservationUuid))
    } catch {}
}
