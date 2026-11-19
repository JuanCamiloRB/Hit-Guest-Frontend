import type { Portfolio, PortfolioListing } from "@/features/properties/lib/properties-cache"
import type { Reservation } from "@/types"

/**
 * Lo que se dice cuando ni la reserva ni el portafolio (ya respondido) conocen
 * la propiedad. Nunca el nombre del alojamiento: mostraría la unidad como si
 * fuera la propiedad. Mientras el portafolio no responde, el nombre va vacío.
 */
export const UNKNOWN_PROPERTY_LABEL = "Propiedad no disponible"

/** «Suite 101 (101)»: nombre del alojamiento con su nombre interno, si lo tiene. */
export function unitLabel(name: string | null | undefined, internalName: string | null | undefined): string {
    const base = name?.trim() || "Alojamiento"
    return internalName?.trim() ? `${base} (${internalName.trim()})` : base
}

/**
 * Completa propiedad y alojamiento de cada fila con el portafolio (una sola
 * petición al BFF, que ya cachea y se invalida al editar propiedades). Sin
 * portafolio, las filas quedan como vinieron de `/reservations`. Solo por uuid:
 * los ids de respaldo (`index + 1`, `listingId` numérico) podrían coincidir
 * entre sí y darle a una fila los nombres de otro alojamiento.
 */
export function withListingNames(rows: Reservation[], portfolio: Portfolio | null): Reservation[] {
    if (!portfolio) return rows
    const propertyNames = new Map<string, string>()
    for (const property of portfolio.properties) if (property.uuid) propertyNames.set(property.uuid, property.name)
    const listings = new Map<string, PortfolioListing>()
    for (const listing of portfolio.listings) if (listing.uuid) listings.set(listing.uuid, listing)
    return rows.map((row) => {
        const listing = row.unitId ? listings.get(row.unitId) : undefined
        const propertyUuid = listing?.propertyId ? String(listing.propertyId) : ""
        const propertyName = propertyNames.get(propertyUuid)
        // Qué automatizaciones están apagadas en SU propiedad: la celda no dice
        // «todavía no corre» de algo que nunca va a correr.
        const inactive = portfolio.inactiveSlugsByProperty?.[propertyUuid || row.propertyId]
        const withInactive = inactive ? { propertyInactiveAutomations: inactive } : {}
        if (!listing) {
            // Sin nada que mejorar, la MISMA fila (no un objeto nuevo en cada render).
            if (!inactive && row.propertyName) return row
            return { ...row, ...withInactive, ...(row.propertyName ? {} : { propertyName: UNKNOWN_PROPERTY_LABEL }) }
        }
        return {
            ...row,
            ...withInactive,
            propertyId: propertyName ? propertyUuid : row.propertyId,
            propertyName: propertyName || row.propertyName || UNKNOWN_PROPERTY_LABEL,
            unitName: unitLabel(listing.name, listing.number),
        }
    })
}
