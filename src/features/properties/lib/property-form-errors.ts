/**
 * Errores del formulario de propiedad, por pestaña. Sin React: lo usan el
 * aviso superior («Faltan N campos: Detalles (2), Ubicación (1)»), el contador
 * accesible de cada pestaña y el salto al primer campo inválido.
 */

export type FormTabId = "details" | "location" | "units" | "photos"

export const TAB_LABELS: Record<FormTabId | "automations" | "documents", string> = {
    details: "Detalles",
    location: "Ubicación",
    units: "Alojamientos",
    photos: "Fotos",
    automations: "Automatización",
    documents: "Documentos",
}

/** Campo del formulario → etiqueta y pestaña donde se corrige. */
export const PROPERTY_FIELD_META: Record<string, { label: string; tab: FormTabId }> = {
    name:           { label: "Nombre de la propiedad", tab: "details" },
    email:          { label: "Correo de contacto",     tab: "details" },
    phone:          { label: "Teléfono",               tab: "details" },
    propertyTypeId: { label: "Tipo de propiedad",      tab: "details" },
    statusRecordId: { label: "Estado",                 tab: "details" },
    externalPmsIds: { label: "Identificación externa", tab: "details" },
    description:    { label: "Descripción",            tab: "details" },
    thumbnailUrl:   { label: "Portada",                tab: "details" },
    communicationsLocale: { label: "Idioma de comunicaciones", tab: "details" },
    amenities:      { label: "Amenidades",             tab: "details" },
    address:        { label: "Dirección",              tab: "location" },
    addressDetail:  { label: "Dirección, línea 2",     tab: "location" },
    city:           { label: "Ciudad",                 tab: "location" },
    state:          { label: "Departamento o estado",  tab: "location" },
    countryId:      { label: "País",                   tab: "location" },
    latitude:       { label: "Latitud",                tab: "location" },
    longitude:      { label: "Longitud",               tab: "location" },
    timezone:       { label: "Zona horaria",           tab: "location" },
    units:          { label: "Alojamientos",           tab: "units" },
    picturesUrl:    { label: "Fotos",                  tab: "photos" },
}

/**
 * Cuántos campos inválidos hay en cada pestaña. Un campo que no conocemos
 * cuenta en Detalles. Un campo de lista (`externalPmsIds`) cuenta una vez
 * aunque falle en varias filas.
 */
export function countErrorsByTab(errors: Record<string, unknown>): Record<FormTabId, number> {
    const counts: Record<FormTabId, number> = { details: 0, location: 0, units: 0, photos: 0 }
    for (const field of Object.keys(errors ?? {})) {
        if (errors[field] == null) continue
        const tab = PROPERTY_FIELD_META[field]?.tab ?? "details"
        counts[tab] += 1
    }
    return counts
}

/** Campos sin `FormMessage` propio en pantalla: su mensaje se muestra en el aviso. */
const ORPHAN_FIELDS = new Set(["units", "picturesUrl", "amenities", "uuid"])

/** Los mensajes de los campos huérfanos, en el orden de `errors`. */
export function orphanErrorMessages(errors: Record<string, unknown>): { field: string; label: string; message: string }[] {
    const out: { field: string; label: string; message: string }[] = []
    for (const field of Object.keys(errors ?? {})) {
        if (!ORPHAN_FIELDS.has(field) || errors[field] == null) continue
        const message = firstErrorMessage(errors[field]) ?? "Campo obligatorio o inválido"
        out.push({ field, label: PROPERTY_FIELD_META[field]?.label ?? field, message })
    }
    return out
}

/**
 * An array field's error has no `message` of its own — the real one sits on
 * the offending row (`externalPmsIds.0.externalId`). Without this, the summary
 * showed the generic "Campo obligatorio o inválido" for those fields.
 */
export function firstErrorMessage(err: unknown): string | undefined {
    if (!err || typeof err !== "object") return undefined
    const direct = (err as { message?: string }).message
    if (direct) return direct
    if (Array.isArray(err)) {
        for (const row of err as Record<string, { message?: string } | undefined>[]) {
            for (const nested of Object.values(row ?? {})) {
                if (nested?.message) return nested.message
            }
        }
    }
    return undefined
}
