/**
 * El canal comercial de una reserva (Airbnb, Booking.com, Expedia, Directo…),
 * tal como lo manda el backend en `source: { id, name, slug }`.
 *
 * Antes la lista y la ficha lo colapsaban en tres valores fijos ("Airbnb",
 * "Booking", "Direct"): una reserva de Expedia, Vrbo o Trip.com se mostraba
 * como DIRECTA. Ahora se conserva el nombre real; el logo sale del `slug`.
 */

/**
 * Respaldo para un backend que todavía no manda `slug`: los ids del catálogo
 * de producción (skill de contratos). Borrar cuando `slug` llegue siempre.
 */
export const LEGACY_CHANNEL_SLUG_BY_ID: Readonly<Record<number, string>> = {
    21: "direct", 22: "airbnb", 23: "booking", 24: "vrbo", 25: "despegar", 26: "expedia", 107: "unknown", 846: "agoda",
}

/** Texto para una reserva cuyo canal no se conoce (sin canal o «Desconocido»). */
export const UNKNOWN_CHANNEL_LABEL = "Origen no informado"

export interface ReservationChannel {
    /** Nombre para mostrar, en español si el backend manda traducciones. */
    name: string
    /** Clave estable del canal (`airbnb`, `direct`…); `null` si no se sabe. */
    slug: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : ""
}

/** El nombre puede llegar como texto o como traducciones `{ es, en }`. */
function readName(source: Record<string, unknown>): string {
    const translations = asRecord(source.name_translations ?? source.nameTranslations)
    const name = asRecord(source.name)
    return text(translations?.es) || text(name?.es) || text(source.name) || text(name?.en) || text(translations?.en)
}

/**
 * Lee el canal de una reserva cruda. `null` = el backend no informó canal:
 * se dice así, nunca se asume «Directo».
 */
export function readReservationChannel(raw: unknown): ReservationChannel | null {
    const source = asRecord(asRecord(raw)?.source)
    if (!source) return null
    const id = Number(source.id)
    const slug = text(source.slug).toLowerCase() || (Number.isInteger(id) ? LEGACY_CHANNEL_SLUG_BY_ID[id] ?? null : null)
    const name = readName(source) || slug
    return name ? { name, slug } : null
}
