/**
 * Integración Airbnb vía iCal — contrato del 2026-09-04 (backend implementado).
 * El feed trae SOLO fechas, identificador, URL de la reserva y últimos 4 del
 * teléfono: ni email, ni ocupación, ni precio. Ver skill hitguest-api-contracts §2f.
 */

export interface IcalFeed {
    uuid: string
    listingUuid: string
    /** Catálogo "Source PMS" (cat. 12); Airbnb = 100. */
    sourcePmsId: number
    icalUrl: string
    /** 6 = Activo, 7 = Inactivo. */
    statusRecordId: number
    lastSyncedAt: string | null
    /** `null` = la última corrida fue limpia. Distingue "sin reservas" de "feed roto". */
    lastSyncError: string | null
}

export interface IcalFeedCreatePayload {
    listingUuid: string
    sourcePmsId: number
    icalUrl: string
    /** El ID del listing en Airbnb — la defensa contra pegar el calendario de otro apartamento. */
    externalListingId: string
}

export interface IcalFeedUpdatePayload {
    icalUrl?: string
    statusRecordId?: number
}

/**
 * `message` lo lee el HUÉSPED (va en el communications_locale de la property,
 * NO sigue X-Locale); `instructions` las lee el PM (sí siguen X-Locale). Que no
 * coincidan los idiomas es correcto, no un bug.
 */
export interface IcalMessageTemplate {
    message: string
    instructions: string
}
