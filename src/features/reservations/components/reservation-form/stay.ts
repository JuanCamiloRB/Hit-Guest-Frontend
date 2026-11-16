import { differenceInDays } from "date-fns"

/**
 * Cálculos de la estancia, sin React: noches, precio por noche y la precarga
 * que hace el alojamiento. Lo que la pantalla muestra sale de aquí; lo que
 * viaja al backend sale de `payload.ts`.
 */

export function nightsBetween(from: Date | undefined, to: Date | undefined): number {
    if (!(from instanceof Date) || !(to instanceof Date)) return 0
    const nights = differenceInDays(to, from)
    return nights > 0 ? nights : 0
}

/** `null` si no hay precio o no hay noches: no se inventa un «por noche». */
export function pricePerNight(total: number | null, nights: number): number | null {
    if (total == null || !Number.isFinite(total) || total <= 0 || nights <= 0) return null
    return total / nights
}

export interface ListingDefaults {
    guests: number | null
    price: number | null
    currency: string | null
}

/**
 * Lo que el alojamiento sugiere (capacidad, precio de salida y moneda), en
 * todas las formas en que el backend lo ha mandado. Igual que leía el diálogo
 * antes del rediseño; `null` donde no hay un valor usable.
 */
export function readListingDefaults(listing: unknown): ListingDefaults {
    if (!listing || typeof listing !== "object") return { guests: null, price: null, currency: null }
    const l = listing as Record<string, unknown>
    const ex = (l.extra && typeof l.extra === "object" ? l.extra : {}) as Record<string, unknown>
    const guests = Number(ex.maxOccupancy ?? ex.max_occupancy ?? l.maxOccupancy ?? 0)
    const price = Number(
        ex.startPrice ?? ex.start_price ?? ex.price ?? l.startPrice ?? l.start_price ?? l.price ?? 0,
    )
    const currency = ex.currency ?? l.currency ?? null
    return {
        guests: guests > 0 ? guests : null,
        price: price > 0 ? price : null,
        currency: typeof currency === "string" && currency.trim() !== "" ? String(currency) : null,
    }
}

export interface PrefillTouched {
    totalGuests: boolean
    totalPrice: boolean
    currency: boolean
}

/**
 * Qué campos llenar con lo que sugiere el alojamiento: SOLO los que el PM no
 * tocó. Antes la respuesta (que llega tarde) pisaba lo que ya había escrito.
 */
export function prefillFromListing(
    defaults: ListingDefaults,
    touched: PrefillTouched,
): { totalGuests?: number; totalPrice?: string; currency?: string } {
    const patch: { totalGuests?: number; totalPrice?: string; currency?: string } = {}
    if (defaults.guests != null && !touched.totalGuests) patch.totalGuests = defaults.guests
    if (defaults.price != null && !touched.totalPrice) patch.totalPrice = String(defaults.price)
    if (defaults.currency != null && !touched.currency) patch.currency = defaults.currency
    return patch
}
