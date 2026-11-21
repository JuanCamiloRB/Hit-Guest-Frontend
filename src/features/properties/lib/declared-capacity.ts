/**
 * Lo que un alojamiento DECLARA de capacidad, tal como lo manda el backend:
 * huéspedes (`extra.maxOccupancy`), habitaciones o camas (`extra.bedRoom`) y
 * baños (`extra.bathRoom`). Un entero positivo, o `null` = no declarado.
 *
 * Existe porque el formulario de la propiedad rellena esos campos con 2, 1 y
 * 1 por omisión (`apiResponseToFormData`): la tabla del editor mostraba esos
 * valores del formulario como si fueran datos, y la pestaña Alojamientos decía
 * «sin declarar» para el mismo alojamiento (auditoría 2026-11-20).
 */
export interface DeclaredCapacity {
    capacity: number | null
    bedrooms: number | null
    bathrooms: number | null
}

function readCount(value: unknown): number | null {
    const count = Number(value)
    return Number.isInteger(count) && count > 0 ? count : null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function readDeclaredCapacity(raw: any): DeclaredCapacity {
    const extra = raw?.extra ?? {}
    return {
        capacity: readCount(extra.maxOccupancy ?? extra.max_occupancy ?? raw?.maxOccupancy),
        bedrooms: readCount(extra.bedRoom ?? extra.bed_room?.bedsCount),
        bathrooms: readCount(extra.bathRoom ?? extra.bath_room?.count),
    }
}
