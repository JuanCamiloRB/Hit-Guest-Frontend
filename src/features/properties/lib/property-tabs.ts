/**
 * Pestañas del formulario de propiedad y el enlace que abre una de ellas.
 *
 * Una sola fuente: el enlace «Automatizaciones» de la tarjeta usaba
 * `?tab=automation` mientras la pestaña se llama `automations`, y el formulario
 * se abría sin contenido. Los nombres viven aquí; quien enlaza usa
 * `propertyEditHref` y el formulario descarta un `?tab=` que no conoce.
 */
export const PROPERTY_TABS = ["details", "units", "automations", "documents", "location", "photos"] as const

export type PropertyTab = (typeof PROPERTY_TABS)[number]

export function isPropertyTab(value: unknown): value is PropertyTab {
    return typeof value === "string" && (PROPERTY_TABS as readonly string[]).includes(value)
}

/** Ruta de edición de la propiedad, opcionalmente abierta en una pestaña. */
export function propertyEditHref(propertyUuid: string | number, tab?: PropertyTab): string {
    const base = `/dashboard/properties/${propertyUuid}`
    return tab ? `${base}?tab=${tab}` : base
}
