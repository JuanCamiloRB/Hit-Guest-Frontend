import { addDays, differenceInCalendarDays, format, isSameMonth, isSameYear, startOfDay } from "date-fns"
import { es } from "date-fns/locale"

import type { TimelineBarTone, TimelineLegendTone } from "@/components/ui/timeline"
import type { Reservation } from "@/types"
import { UNKNOWN_PROPERTY_LABEL } from "./listing-names"

/**
 * La vista de ocupación del calendario de Operaciones: una fila por alojamiento
 * y una barra por estadía, en una ventana de días. Sin React: decide qué entra,
 * dónde empieza y termina cada barra y en qué carril va.
 *
 * Las posiciones van en días desde el primero de la vista, con la estadía del
 * centro del día de check-in al centro del día de checkout: la barra «termina
 * en la fecha de checkout» y una salida y una entrada el mismo día no se pisan.
 */

export const OCCUPANCY_DAYS = 14

/** Las que no ocupan el alojamiento: no se dibujan en la ocupación. */
const NOT_OCCUPYING: ReadonlySet<Reservation["status"]> = new Set(["CANCELLED", "DELETED"])

export function windowDays(start: Date, count = OCCUPANCY_DAYS): Date[] {
    const first = startOfDay(start)
    return Array.from({ length: count }, (_, i) => addDays(first, i))
}

/** «16–29 octubre 2026», «28 oct – 10 nov 2026» o «28 dic 2026 – 10 ene 2027». */
export function periodLabel(days: readonly Date[]): string {
    const first = days[0]
    const last = days[days.length - 1]
    if (!first || !last) return ""
    if (isSameMonth(first, last)) return `${format(first, "d")}–${format(last, "d MMMM yyyy", { locale: es })}`
    if (isSameYear(first, last)) return `${format(first, "d MMM", { locale: es })} – ${format(last, "d MMM yyyy", { locale: es })}`
    return `${format(first, "d MMM yyyy", { locale: es })} – ${format(last, "d MMM yyyy", { locale: es })}`
}

export function nightsOf(reservation: Reservation): number {
    if (Number.isFinite(reservation.nights) && reservation.nights >= 0) return reservation.nights
    return Math.max(0, differenceInCalendarDays(reservation.checkOut, reservation.checkIn))
}

export function nightsText(nights: number): string {
    return `${nights} ${nights === 1 ? "noche" : "noches"}`
}

/** «Ana Gómez +1»: el titular y cuántos huéspedes más, solo si la reserva lo dice. */
export function guestText(reservation: Reservation): string {
    const name = reservation.guestName?.trim() || "Huésped"
    const extra = reservation.totalGuests && reservation.totalGuests > 1 ? ` +${reservation.totalGuests - 1}` : ""
    return `${name}${extra}`
}

const dateText = (date: Date) => format(date, "d MMM yyyy", { locale: es })

/** La propiedad, o vacío si la reserva no la trae («Propiedad no disponible» no es un dato). */
function knownProperty(reservation: Reservation): string {
    const name = reservation.propertyName?.trim() ?? ""
    return name === UNKNOWN_PROPERTY_LABEL ? "" : name
}

/** El nombre accesible de la barra: quién, dónde y las dos fechas. */
export function stayLabel(reservation: Reservation): string {
    return `${guestText(reservation)}, ${reservation.unitName}: check-in ${dateText(reservation.checkIn)}, checkout ${dateText(reservation.checkOut)}, ${nightsText(nightsOf(reservation))}`
}

/** El detalle de la barra: solo lo que la reserva trae (sin código inventado). */
export function stayDetails(reservation: Reservation): [string, string][] {
    const rows: [string, string][] = [
        ["Alojamiento", reservation.unitName],
        ["Propiedad", knownProperty(reservation)],
        ["Check-in", dateText(reservation.checkIn)],
        ["Checkout", dateText(reservation.checkOut)],
        ["Duración", nightsText(nightsOf(reservation))],
    ]
    if (reservation.totalGuests && reservation.totalGuests > 0) {
        rows.push(["Huéspedes", String(reservation.totalGuests)])
    }
    // El estado no va como fila: lo muestra el StatusPill del detalle.
    return rows.filter(([, value]) => value !== "")
}

/**
 * El trazo de la barra según el estado (TimelineBar `tone`). El morado siempre
 * dice «ocupado»; el trazo dice en qué está la reserva:
 * - Confirmada y los estados de check-in que siguen en curso: sólida.
 * - En progreso (y «Link enviado»): rayada. No se interpreta qué la dispara.
 * - Finalizada (y «Check-out realizado»): tenue.
 * - Abandonada, Incompleta y los pendientes de check-in: punteada. El backend
 *   no dijo si Abandonada e Incompleta son terminales; se piden mirar.
 * - Desconocido o un estado que el front no mapea: tramada.
 * Canceladas y eliminadas no se dibujan (`NOT_OCCUPYING`); si llegaran, tenues.
 */
const BAR_TONE: Record<Reservation["status"], TimelineBarTone> = {
    CONFIRMED: "default",
    CHECKED_IN: "default",
    NO_STARTED: "default",
    IN_PROGRESS: "progress",
    LINK_SENT: "progress",
    CLOSED: "past",
    CHECKED_OUT: "past",
    CANCELLED: "past",
    DELETED: "past",
    ABANDONED: "attention",
    INCOMPLETE: "attention",
    PENDING: "attention",
    PENDING_CONTRACT: "attention",
    UNKNOWN: "unknown",
}

export function barTone(status: Reservation["status"]): TimelineBarTone {
    return BAR_TONE[status] ?? "unknown"
}

/** La leyenda de la vista de ocupación: un trazo por grupo de estados. */
export const BAR_LEGEND: readonly TimelineLegendTone[] = [
    { tone: "default", label: "Confirmada" },
    { tone: "progress", label: "En progreso" },
    { tone: "past", label: "Finalizada" },
    { tone: "attention", label: "Abandonada o incompleta" },
    { tone: "unknown", label: "Sin estado" },
]

export interface OccupancyBar {
    reservation: Reservation
    start: number
    end: number
    track: number
    /** El check-in o el checkout caen dentro de la vista (se marca ese extremo). */
    checkin: boolean
    checkout: boolean
}

export interface OccupancyRow {
    unitId: string
    unitName: string
    propertyName: string
    bars: OccupancyBar[]
    tracks: number
}

const COLLATOR = new Intl.Collator("es", { sensitivity: "base", numeric: true })

/**
 * Las filas de la vista: solo los alojamientos con alguna estadía dentro de la
 * ventana, ordenados por nombre. Dos estadías que se cruzan en el mismo
 * alojamiento (un dato que el PM debe ver) van en carriles distintos.
 */
export function occupancyRows(reservations: readonly Reservation[], windowStart: Date, count = OCCUPANCY_DAYS): OccupancyRow[] {
    const first = startOfDay(windowStart)
    const byUnit = new Map<string, OccupancyRow>()
    for (const reservation of reservations) {
        if (NOT_OCCUPYING.has(reservation.status)) continue
        const inIndex = differenceInCalendarDays(reservation.checkIn, first)
        const outIndex = differenceInCalendarDays(reservation.checkOut, first)
        if (inIndex > count - 1 || outIndex < 0) continue
        const checkin = inIndex >= 0
        const checkout = outIndex <= count - 1
        // Entra y sale el mismo día: ocupa ese día entero, centrado, para que
        // quepan las dos marcas. El resto va del centro del check-in al centro
        // del checkout (medio día si solo se ve un extremo: una sola marca).
        const sameDay = checkin && checkout && outIndex === inIndex
        const start = sameDay ? inIndex : checkin ? inIndex + 0.5 : 0
        const end = sameDay ? inIndex + 1 : checkout ? outIndex + 0.5 : count
        const key = unitKey(reservation)
        let row = byUnit.get(key)
        if (!row) {
            row = { unitId: key, unitName: reservation.unitName || "Alojamiento sin nombre", propertyName: knownProperty(reservation), bars: [], tracks: 1 }
            byUnit.set(key, row)
        }
        row.bars.push({ reservation, start, end, track: 0, checkin, checkout })
    }
    const rows = [...byUnit.values()]
    for (const row of rows) {
        row.bars.sort((a, b) => a.start - b.start || a.end - b.end)
        const trackEnds: number[] = []
        for (const bar of row.bars) {
            const free = trackEnds.findIndex((end) => end <= bar.start)
            bar.track = free === -1 ? trackEnds.length : free
            trackEnds[bar.track] = bar.end
        }
        row.tracks = Math.max(1, trackEnds.length)
    }
    return rows.sort((a, b) => COLLATOR.compare(a.unitName, b.unitName))
}

/**
 * Las selecciones de los filtros que siguen siendo válidas con la lista que
 * llegó: una propiedad o un alojamiento que ya no aparece sale de la selección
 * (si no, el filtro diría «Todos» y seguiría filtrando por un id invisible), y
 * un alojamiento elegido tiene que pertenecer a alguna propiedad elegida.
 * Devuelve los MISMOS conjuntos si nada cambió (sin renders de más).
 */
export function pruneSelection(
    reservations: readonly Reservation[],
    properties: ReadonlySet<string>,
    units: ReadonlySet<string>,
): { properties: ReadonlySet<string>; units: ReadonlySet<string> } {
    const propertyIds = new Set(reservations.map((r) => r.propertyId).filter(Boolean))
    const nextProperties = [...properties].every((id) => propertyIds.has(id))
        ? properties
        : new Set([...properties].filter((id) => propertyIds.has(id)))
    const unitIds = new Set(
        reservations
            .filter((r) => nextProperties.size === 0 || (r.propertyId && nextProperties.has(r.propertyId)))
            .map(unitKey),
    )
    const nextUnits = [...units].every((id) => unitIds.has(id)) ? units : new Set([...units].filter((id) => unitIds.has(id)))
    return { properties: nextProperties, units: nextUnits }
}

/** Normaliza para buscar sin mayúsculas ni acentos. */
function fold(text: string | null | undefined): string {
    return (text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/** La clave de un alojamiento: su id o, sin él, propiedad + nombre (la misma de las filas). */
export function unitKey(reservation: Reservation): string {
    return reservation.unitId || `${reservation.propertyId}:${reservation.unitName}`
}

/**
 * Filtra por propiedades y alojamientos elegidos (vacío = todos) y por texto en
 * alojamiento, propiedad o huésped. Los filtros exactos y la búsqueda se suman.
 */
export function filterReservations(
    reservations: readonly Reservation[],
    { properties, units, query }: { properties: ReadonlySet<string>; units: ReadonlySet<string>; query: string },
): Reservation[] {
    const q = fold(query.trim())
    return reservations.filter((r) => {
        if (properties.size > 0 && !(r.propertyId && properties.has(r.propertyId))) return false
        if (units.size > 0 && !units.has(unitKey(r))) return false
        if (!q) return true
        return [r.unitName, r.propertyName, r.guestName].some((text) => fold(text).includes(q))
    })
}
