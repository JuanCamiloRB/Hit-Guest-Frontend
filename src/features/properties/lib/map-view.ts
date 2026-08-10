/**
 * Decide qué vista mostrar el mapa a partir de las coordenadas del formulario.
 *
 * Existe porque el cálculo vivía como un `form.watch("latitude") || 0` en la
 * pantalla, y ese `|| 0` tiene dos problemas encadenados:
 *
 *  1. El esquema declara `latitude: z.coerce.number().default(0)`, así que "sin
 *     ubicación" y "latitud cero" son literalmente el mismo valor.
 *  2. Centrar en (0, 0) a zoom 15 deja al usuario en medio del golfo de Guinea:
 *     un rectángulo azul uniforme, sin costa ni referencias. No parece "no hay
 *     ubicación", parece que el mapa está roto — y el usuario no tiene forma de
 *     saber que basta con arrastrar el pin.
 *
 * Tratar (0, 0) como "sin definir" es deliberado: es el valor por defecto del
 * esquema, y una propiedad real en esa coordenada exacta está en mar abierto.
 */

/** Zoom a nivel de calle, para cuando sí sabemos dónde está la propiedad. */
const STREET_ZOOM = 15
/**
 * Vista amplia para cuando no lo sabemos: suficiente para que el usuario
 * reconozca continentes y navegue hasta su ciudad a arrastrar el pin.
 */
const WORLD_ZOOM = 2

/** Centro neutro cuando no hay nada que mostrar (Atlántico, vista de mundo). */
const FALLBACK_CENTER = { lat: 20, lng: -30 }

export interface MapView {
    lat: number
    lng: number
    zoom: number
    /** `false` cuando la propiedad todavía no tiene una ubicación real. */
    hasCoordinates: boolean
}

/** Una coordenada utilizable: numérica, finita y dentro de rango. */
function isUsable(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
    if (lat < -90 || lat > 90) return false
    if (lng < -180 || lng > 180) return false
    // El (0, 0) exacto es el default del esquema, no una ubicación elegida.
    // Se usa una tolerancia mínima porque el valor puede venir del backend como
    // la cadena "0.00000000" y volver como 0, o como -0.
    return Math.abs(lat) > 1e-7 || Math.abs(lng) > 1e-7
}

export function resolveMapView(rawLat: unknown, rawLng: unknown): MapView {
    const lat = Number(rawLat)
    const lng = Number(rawLng)

    if (isUsable(lat, lng)) {
        return { lat, lng, zoom: STREET_ZOOM, hasCoordinates: true }
    }
    return { ...FALLBACK_CENTER, zoom: WORLD_ZOOM, hasCoordinates: false }
}
