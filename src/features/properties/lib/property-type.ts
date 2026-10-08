/**
 * El tipo de una propiedad es un id del catálogo `property_type`
 * (`GET /catalogs?catalogCategoryName[eq]=property_type`). Verificado el
 * 2026-10-06: 102 Hotel · 103 Apartment · 104 Condominium · 105 Studio · 106 House.
 *
 * Una sola lectura para las tres pantallas que lo necesitan, y sin default: el
 * front completaba un tipo ausente con `102` creyendo que era «Apartamento», y
 * en el catálogo real 102 es **Hotel**. Toda propiedad sin tipo (las importadas
 * de un PMS, por ejemplo) se mostraba como hotel, y al editarla el formulario
 * lo guardaba así. `null` = el backend no informó tipo; la UI lo dice en vez de
 * elegir uno.
 */
export function readPropertyTypeId(raw: unknown): number | null {
    if (!raw || typeof raw !== "object") return null
    const r = raw as Record<string, unknown>
    const extra = (r.extra && typeof r.extra === "object" ? r.extra : {}) as Record<string, unknown>
    const nested = (r.propertyType && typeof r.propertyType === "object" ? r.propertyType : {}) as Record<string, unknown>

    for (const candidate of [nested.id, r.propertyTypeId, r.property_type_id, extra.propertyTypeId]) {
        const id = typeof candidate === "string" && candidate.trim() !== "" ? Number(candidate) : candidate
        if (typeof id === "number" && Number.isInteger(id) && id > 0) return id
    }
    return null
}
