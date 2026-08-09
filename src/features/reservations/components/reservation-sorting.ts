import type { AutomationStatus, Reservation } from "@/types"

/**
 * Ordenamiento de la tabla de Operaciones.
 *
 * Hasta ahora la tabla no ordenaba NADA: `DataTable` ya montaba
 * `getSortedRowModel()`, pero los encabezados eran strings planos sin control
 * que los disparara, así que las filas salían en el orden en que las devuelve
 * `GET /reservations` (orden de inserción del backend). Por eso dos reservas
 * creadas con segundos de diferencia aparecían pegadas y el resto se veía
 * aleatorio: el criterio real era `created_at`, un dato que la tabla ni
 * siquiera muestra como columna.
 *
 * Este módulo concentra los comparadores porque ninguna de las columnas
 * interesantes se ordena bien "sola":
 *  • el estado es un enum cuyo orden alfabético (CANCELLED < CONFIRMED) no
 *    significa nada para el operador;
 *  • las columnas de automatización guardan "success" | "pending" | "none",
 *    que alfabéticamente queda none < pending < success — al revés de lo que
 *    alguien quiere ver primero;
 *  • los nombres llegan con acentos y en mayúsculas/minúsculas mezcladas.
 */

/** Comparador base: -1, 0 o 1. Lo que TanStack espera de un `sortingFn`. */
export type Comparator<T> = (a: T, b: T) => number

/**
 * Orden operativo de los estados, siguiendo los ids del catálogo (27→109) que
 * ya documenta el servicio. Un número más bajo aparece primero en ascendente.
 */
export const STATUS_ORDER: Record<Reservation["status"], number> = {
    CONFIRMED: 0,
    IN_PROGRESS: 1,
    PENDING: 2,
    PENDING_CONTRACT: 3,
    LINK_SENT: 4,
    NO_STARTED: 5,
    CHECKED_IN: 6,
    CHECKED_OUT: 7,
    CLOSED: 8,
    CANCELLED: 9,
    DELETED: 10,
    UNKNOWN: 11,
}

/**
 * Severidad de una luz de automatización: primero lo que exige acción.
 *
 * `pending` va antes que `success` a propósito. Ordenar por la columna
 * CONTRATO sirve para responder "¿cuáles me faltan por firmar?", no para
 * agrupar los que ya están listos.
 */
export const LIGHT_ORDER: Record<AutomationStatus[keyof AutomationStatus], number> = {
    pending: 0,
    success: 1,
    none: 2,
}

/**
 * Compara textos como los lee una persona en español: sin distinguir
 * mayúsculas y tratando "Álvarez" junto a "Alvarez" en vez de mandarlo al
 * final por su code point.
 */
export function compareText(a: string, b: string): number {
    return (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base", numeric: true })
}

/** Compara fechas tolerando un valor inválido o ausente, que se va al final. */
export function compareDates(a: Date | null | undefined, b: Date | null | undefined): number {
    const ta = a instanceof Date && !Number.isNaN(a.getTime()) ? a.getTime() : null
    const tb = b instanceof Date && !Number.isNaN(b.getTime()) ? b.getTime() : null
    if (ta === null && tb === null) return 0
    if (ta === null) return 1
    if (tb === null) return -1
    return ta - tb
}

/** Compara dos estados de reserva por su orden operativo. */
export function compareStatus(a: Reservation["status"], b: Reservation["status"]): number {
    const ra = STATUS_ORDER[a] ?? STATUS_ORDER.UNKNOWN
    const rb = STATUS_ORDER[b] ?? STATUS_ORDER.UNKNOWN
    return ra - rb
}

/** Compara la luz `key` de dos reservas por severidad (lo pendiente primero). */
export function compareLight(
    key: keyof AutomationStatus,
    a: AutomationStatus | undefined,
    b: AutomationStatus | undefined,
): number {
    const la = LIGHT_ORDER[a?.[key] ?? "none"]
    const lb = LIGHT_ORDER[b?.[key] ?? "none"]
    return la - lb
}

/**
 * Orden por defecto: fecha de check-in descendente.
 *
 * Es la única fecha que la tabla muestra, y era el punto del pedido: ordenar
 * por `created_at` (lo que hacía de facto) es ordenar por una columna que el
 * usuario no ve, así que el resultado parece arbitrario. Para cambiar el
 * sentido basta con `desc: false`.
 */
export const DEFAULT_SORTING = [{ id: "checkIn", desc: true }] as const
