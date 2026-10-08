/**
 * Valor de la reserva declarado por el huésped principal — contrato 2026-09-27
 * §2.1 (Airbnb iCal). Lectura para MOSTRAR, nada gatea acciones: una clave
 * ausente no es noticia (skill untrusted-network-data §4), así que
 * `declaredByGuest` solo es `true` con un `true` EXPLÍCITO del backend.
 *
 * `extra.guestPriceDeclaration` es un registro de auditoría: se conserva
 * aunque el PM corrija el valor, y NUNCA se reenvía en un PUT (clave
 * reservada, el backend la descarta).
 */

export interface GuestPriceDeclaration {
    amount: number
    currency: string | null
    guestUuid: string | null
    /** ISO-8601 con zona (`2026-10-01T15:04:05+00:00`). */
    declaredAt: string | null
}

export interface PriceDeclarationInfo {
    /** `true` = el valor vigente lo escribió el huésped: la señal de «revisa esto». */
    declaredByGuest: boolean
    /** Historial: qué declaró, cuándo y quién. `null` si nunca declaró. */
    declaration: GuestPriceDeclaration | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key]
        if (typeof value === "string" && value.trim() !== "") return value
    }
    return null
}

export function readPriceDeclaration(rawReservation: unknown): PriceDeclarationInfo {
    const reservation = asRecord(rawReservation)
    if (!reservation) return { declaredByGuest: false, declaration: null }

    const declaredByGuest = (reservation.priceDeclaredByGuest ?? reservation.price_declared_by_guest) === true

    const extra = asRecord(reservation.extra)
    const raw = asRecord(extra?.guestPriceDeclaration ?? extra?.guest_price_declaration)
    let declaration: GuestPriceDeclaration | null = null
    if (raw) {
        // `amount` llega como string decimal (`"850000.00"`), igual que `totalPrice`.
        const amount = Number(raw.amount)
        if (Number.isFinite(amount)) {
            declaration = {
                amount,
                currency: readString(raw, "currency"),
                guestUuid: readString(raw, "guestUuid", "guest_uuid"),
                declaredAt: readString(raw, "declaredAt", "declared_at"),
            }
        }
    }
    return { declaredByGuest, declaration }
}

/** «1 oct 2026» a partir del ISO con zona; `null` si no se puede leer. */
export function formatDeclaredAt(iso: string | null): string | null {
    if (!iso) return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date)
}
