/**
 * Reglas puras del flujo de feeds iCal.
 */

/**
 * Extrae el ID del listing de una URL de calendario de Airbnb
 * (`…/calendar/ical/12345678.ics?s=…`). Autocompletarlo al pegar la URL evita
 * el 422 más probable (ID que no coincide) — que no es un detalle de
 * validación: es la defensa contra importar las reservas de otro apartamento.
 * `null` si la URL no trae el patrón; el campo queda editable igual.
 */
export function extractAirbnbListingId(url: string): string | null {
    return /\/calendar\/ical\/(\d+)\.ics/.exec(url)?.[1] ?? null
}

/** Airbnb en el catálogo "Source PMS" (cat. 12) — verificado por curl (skill, catálogo source_pms). */
export const AIRBNB_SOURCE_PMS_ID = 100
