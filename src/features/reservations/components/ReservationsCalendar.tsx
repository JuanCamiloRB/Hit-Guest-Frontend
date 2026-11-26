"use client"

import { useMemo, useState } from "react"
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"
import { BedDouble, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Home } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { IconBadge } from "@/components/ui/icon-badge"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { LoadingState, RefreshIndicator } from "@/components/ui/loading-state"
import { MovementMark, MOVEMENT_LABEL, type MovementKind } from "@/components/ui/movement-mark"
import { MultiSelect } from "@/components/ui/multi-select"
import { SearchField } from "@/components/ui/search-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Timeline, TimelineBar, TimelineLegend, TimelineRow } from "@/components/ui/timeline"
import { cn } from "@/lib/utils"
import type { Reservation } from "@/types"
import { useReservations } from "../hooks/useReservations"
import { cancelDetailPrefetch, startDetailPrefetch } from "../lib/detail-prefetch"
import {
    BAR_LEGEND,
    barTone,
    filterReservations,
    guestText,
    nightsOf,
    nightsText,
    occupancyRows,
    OCCUPANCY_DAYS,
    periodLabel,
    pruneSelection,
    stayDetails,
    stayLabel,
    unitKey,
    windowDays,
} from "../lib/occupancy"
import { UNKNOWN_PROPERTY_LABEL } from "../lib/listing-names"
import { getReservationStatusMeta } from "./reservation-status-meta"

/** El nombre de la propiedad para el filtro; sin dato, se dice así (no el texto de reemplazo). */
function knownPropertyName(r: Reservation): string {
    return r.propertyName && r.propertyName !== UNKNOWN_PROPERTY_LABEL ? r.propertyName : "Sin propiedad"
}

/** True only when both dates are valid and ordered — safe to compare per-day. */
function hasValidStay(res: Reservation): boolean {
    const { checkIn, checkOut } = res
    return (
        checkIn instanceof Date && !isNaN(checkIn.getTime()) &&
        checkOut instanceof Date && !isNaN(checkOut.getTime()) &&
        checkIn.getTime() <= checkOut.getTime()
    )
}

type CalendarView = "occupancy" | "month"
// Qué movimientos muestra la vista Mes («Ambos» = entradas y salidas).
type MovementFilter = "both" | "in" | "out"
const MOVEMENT_FILTERS: { value: MovementFilter; label: string }[] = [
    { value: "both", label: "Ambos" },
    { value: "in", label: "Solo check-in" },
    { value: "out", label: "Solo checkout" },
]

const reservationHref = (id: string) => `/dashboard/reservations/${id}`
const BY_NAME = new Intl.Collator("es", { sensitivity: "base", numeric: true })
const sortByName = <T extends { name: string }>(items: T[]) => items.sort((a, b) => BY_NAME.compare(a.name, b.name))
function toggled(set: ReadonlySet<string>, id: string): Set<string> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
}
const prefetchProps = (id: string) => ({
    onMouseEnter: () => startDetailPrefetch(id),
    onMouseLeave: () => cancelDetailPrefetch(id),
    onFocus: () => startDetailPrefetch(id),
    onBlur: () => cancelDetailPrefetch(id),
})

/**
 * El calendario de Operaciones. Dos vistas sobre la misma lista de reservas:
 * «Ocupación» (una fila por alojamiento y una barra por estadía, 14 días) y
 * «Mes» (las entradas y salidas de cada día). Arriba, la barra navy del
 * periodo con sus flechas y «Hoy»; debajo, buscar, filtrar por propiedad,
 * cambiar de vista y la leyenda. Diseño: work/hitguest-calendario-rangos-v1.html.
 */
export function ReservationsCalendar() {
    // La misma lista que Operaciones: cambiar de pestaña no vuelve a pedirla.
    const { reservations: loaded, status, syncing, refreshFailed, refresh } = useReservations()
    const reservations = useMemo(() => (loaded ?? []).filter(hasValidStay), [loaded])
    const [view, setView] = useState<CalendarView>("occupancy")
    const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()))
    const [month, setMonth] = useState(() => startOfMonth(new Date()))
    const [query, setQuery] = useState("")
    const [movement, setMovement] = useState<MovementFilter>("both")
    // Filtros exactos de selección múltiple (vacío = todos), como el calendario
    // anterior: la búsqueda no distingue alojamientos de nombre parecido.
    const [selectedProperties, setSelectedProperties] = useState<ReadonlySet<string>>(new Set())
    const [selectedUnits, setSelectedUnits] = useState<ReadonlySet<string>>(new Set())
    // Con cada lista nueva, lo elegido que ya no existe sale de la selección:
    // si no, el filtro diría «Todos» y seguiría filtrando por un id invisible.
    // Ajuste durante el render (no en un efecto): sin una pintura intermedia.
    const [seenReservations, setSeenReservations] = useState(reservations)
    if (seenReservations !== reservations) {
        setSeenReservations(reservations)
        const next = pruneSelection(reservations, selectedProperties, selectedUnits)
        if (next.properties !== selectedProperties) setSelectedProperties(next.properties)
        if (next.units !== selectedUnits) setSelectedUnits(next.units)
    }

    // Solo se ofrecen las propiedades que aparecen en las reservas cargadas.
    const properties = useMemo(() => {
        const map = new Map<string, string>()
        reservations.forEach((r) => { if (r.propertyId) map.set(r.propertyId, knownPropertyName(r)) })
        return sortByName([...map].map(([id, name]) => ({ id, name })))
    }, [reservations])
    // Los alojamientos se acotan a las propiedades elegidas: el segundo filtro
    // nunca ofrece uno que no pertenece a las elegidas.
    const units = useMemo(() => {
        const map = new Map<string, string>()
        reservations
            .filter((r) => selectedProperties.size === 0 || (r.propertyId && selectedProperties.has(r.propertyId)))
            .forEach((r) => map.set(unitKey(r), r.unitName || "Alojamiento sin nombre"))
        return sortByName([...map].map(([id, name]) => ({ id, name })))
    }, [reservations, selectedProperties])

    const toggleProperty = (id: string) => {
        const next = toggled(selectedProperties, id)
        setSelectedProperties(next)
        // Quita los alojamientos elegidos que ya no pertenecen a las propiedades elegidas.
        if (next.size > 0) {
            const allowed = new Set(reservations.filter((r) => r.propertyId && next.has(r.propertyId)).map(unitKey))
            setSelectedUnits((prev) => new Set([...prev].filter((u) => allowed.has(u))))
        }
    }

    const filtered = useMemo(
        () => filterReservations(reservations, { properties: selectedProperties, units: selectedUnits, query }),
        [reservations, selectedProperties, selectedUnits, query],
    )

    const occupancy = view === "occupancy"
    const days = useMemo(() => windowDays(windowStart, OCCUPANCY_DAYS), [windowStart])
    const monthTitle = format(month, "MMMM yyyy", { locale: es })
    const title = occupancy ? periodLabel(days) : monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)

    const step = (direction: 1 | -1) => {
        if (occupancy) setWindowStart((d) => addDays(d, direction * OCCUPANCY_DAYS))
        else setMonth((m) => addMonths(m, direction))
    }
    const goToday = () => {
        setWindowStart(startOfDay(new Date()))
        setMonth(startOfMonth(new Date()))
    }

    return (
        <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)} className="space-y-3">
            <Surface tone="brand" flat className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    <IconBadge icon={occupancy ? CalendarRange : CalendarDays} tone="strong" shape="square" size="sm" />
                    <Heading level={2} size="title" tone="inverse" aria-live="polite">{title}</Heading>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="inverse" size="icon" aria-label={occupancy ? "Periodo anterior" : "Mes anterior"} onClick={() => step(-1)}>
                        <Icon icon={ChevronLeft} />
                    </Button>
                    <Button type="button" onClick={goToday}>Hoy</Button>
                    <Button type="button" variant="inverse" size="icon" aria-label={occupancy ? "Periodo siguiente" : "Mes siguiente"} onClick={() => step(1)}>
                        <Icon icon={ChevronRight} />
                    </Button>
                </div>
            </Surface>

            <Surface className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <SearchField
                        label="Buscar alojamiento o huésped"
                        placeholder="Buscar alojamiento o huésped"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full sm:w-72"
                    />
                    <MultiSelect
                        label="Filtrar por propiedad"
                        allLabel="Todas las propiedades"
                        selectedWord="propiedades"
                        icon={Home}
                        options={properties}
                        selected={selectedProperties}
                        onToggle={toggleProperty}
                        onClear={() => { setSelectedProperties(new Set()); setSelectedUnits(new Set()) }}
                    />
                    <MultiSelect
                        label="Filtrar por alojamiento"
                        allLabel="Todos los alojamientos"
                        selectedWord="alojamientos"
                        icon={BedDouble}
                        options={units}
                        selected={selectedUnits}
                        onToggle={(id) => setSelectedUnits((prev) => toggled(prev, id))}
                        onClear={() => setSelectedUnits(new Set())}
                    />
                    <TabsList aria-label="Vista del calendario">
                        <TabsTrigger value="month">Mes</TabsTrigger>
                        <TabsTrigger value="occupancy">Ocupación</TabsTrigger>
                    </TabsList>
                    {!occupancy && (
                        // Conmutadores (contrato §5): ghost con aria-pressed, no Tabs sin paneles.
                        <div role="group" aria-label="Filtrar movimientos" className="inline-flex gap-1">
                            {MOVEMENT_FILTERS.map((opt) => (
                                <Button key={opt.value} type="button" variant="ghost" size="sm" aria-pressed={movement === opt.value} onClick={() => setMovement(opt.value)}>
                                    {opt.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <RefreshIndicator active={status === "refreshing"} label="Actualizando reservas…" />
                    <TimelineLegend stay={occupancy} tones={BAR_LEGEND} />
                </div>
            </Surface>

            <TabsContent value="occupancy" className="space-y-3">
                <LoadStates loaded={loaded !== null} status={status} syncing={syncing} refreshFailed={refreshFailed} onRetry={refresh} loadingLabel="Cargando la ocupación">
                    <OccupancyBoard reservations={filtered} days={days} />
                </LoadStates>
            </TabsContent>
            <TabsContent value="month" className="space-y-3">
                <LoadStates loaded={loaded !== null} status={status} syncing={syncing} refreshFailed={refreshFailed} onRetry={refresh} loadingLabel="Cargando el calendario">
                    <MonthGrid reservations={filtered} month={month} movement={movement} />
                </LoadStates>
            </TabsContent>
        </Tabs>
    )
}

/**
 * La escala de estados de la lista (Fase 2.2), igual que en la Lista de
 * Operaciones: sin lista, la carga es un esqueleto, el 202 un aviso de
 * sincronización y el fallo un aviso bloqueante con «Reintentar» (nunca un
 * vacío). Con lista, se muestra siempre; si la actualización falló, con un
 * aviso de que puede no ser la actual. El vacío solo existe con lista cargada.
 */
function LoadStates({ loaded, status, syncing, refreshFailed, onRetry, loadingLabel, children }: {
    loaded: boolean
    status: "loading" | "refreshing" | "ready" | "error"
    syncing: boolean
    refreshFailed: boolean
    onRetry: () => void
    loadingLabel: string
    children: React.ReactNode
}) {
    const retry = <Button type="button" variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
    if (!loaded) {
        if (syncing) {
            return (
                <FeedbackBanner tone="info" mode="dynamic" title="Las reservas se están sincronizando" action={retry}>
                    Intenta nuevamente en unos segundos.
                </FeedbackBanner>
            )
        }
        if (status === "error") {
            return (
                <FeedbackBanner tone="danger" mode="blocking" title="No pudimos cargar las reservas" action={retry}>
                    Revisa tu conexión e intenta de nuevo.
                </FeedbackBanner>
            )
        }
        return <LoadingState rows={6} label={loadingLabel} />
    }
    return (
        <>
            {refreshFailed && (
                <FeedbackBanner tone="warning" mode="dynamic" action={retry}>
                    No pudimos actualizar el calendario. Se muestran las últimas reservas cargadas.
                </FeedbackBanner>
            )}
            {children}
        </>
    )
}

function OccupancyBoard({ reservations, days }: { reservations: Reservation[]; days: Date[] }) {
    const rows = useMemo(() => occupancyRows(reservations, days[0], days.length), [reservations, days])
    // Cuántos alojamientos con reservas hay en la búsqueda (no el portafolio entero:
    // la lista de reservas no trae los alojamientos que nunca tuvieron una).
    const units = useMemo(() => new Set(reservations.map(unitKey)).size, [reservations])
    if (rows.length === 0) {
        return (
            <Surface className="py-2">
                <EmptyState icon={CalendarRange} title="No hay estadías en este periodo" description="Cambia de periodo con las flechas, o quita la búsqueda y los filtros de propiedad y de alojamiento." />
            </Surface>
        )
    }
    return (
        <Timeline
            days={days}
            label="Ocupación por alojamiento"
            resourceLabel={`${rows.length} ${rows.length === 1 ? "alojamiento" : "alojamientos"}`}
            footer={`Mostrando ${rows.length} de ${units} ${units === 1 ? "alojamiento" : "alojamientos"} con reservas`}
            footerNote="Las barras terminan en la fecha de checkout"
        >
            {rows.map((row) => (
                <TimelineRow key={row.unitId} title={row.unitName} subtitle={row.propertyName || undefined} tracks={row.tracks}>
                    {row.bars.map((bar) => (
                        <TimelineBar
                            key={bar.reservation.id}
                            start={bar.start}
                            end={bar.end}
                            track={bar.track}
                            href={reservationHref(bar.reservation.id)}
                            label={stayLabel(bar.reservation)}
                            checkin={bar.checkin}
                            checkout={bar.checkout}
                            tone={barTone(bar.reservation.status)}
                            status={getReservationStatusMeta(bar.reservation.status, bar.reservation.statusLabel, bar.reservation.statusId)}
                            detailTitle={guestText(bar.reservation)}
                            details={stayDetails(bar.reservation)}
                            linkProps={prefetchProps(bar.reservation.id)}
                        >
                            {guestText(bar.reservation)} · {nightsText(nightsOf(bar.reservation))}
                        </TimelineBar>
                    ))}
                </TimelineRow>
            ))}
        </Timeline>
    )
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]

/** La vista Mes: cada día con sus entradas y salidas, con las mismas marcas que la ocupación. */
function MonthGrid({ reservations, month, movement }: { reservations: Reservation[]; month: Date; movement: MovementFilter }) {
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    })
    const today = new Date()
    return (
        <Surface className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-rule bg-table-head" aria-hidden="true">
                {WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold text-ink">{d}</div>)}
            </div>
            <ul className="grid grid-cols-7">
                {days.map((day, index) => {
                    const ins = movement !== "out" ? reservations.filter((r) => isSameDay(day, r.checkIn)) : []
                    const outs = movement !== "in" ? reservations.filter((r) => isSameDay(day, r.checkOut)) : []
                    const outside = !isSameMonth(day, month)
                    return (
                        <li
                            key={day.toISOString()}
                            aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
                            className={cn("flex min-h-28 flex-col gap-1 border-b border-r border-rule p-2", (index + 1) % 7 === 0 && "border-r-0", outside && "bg-sunk/50")}
                        >
                            <span className={cn(
                                "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                                isSameDay(day, today) ? "bg-primary text-primary-foreground" : outside ? "text-ink-3" : "text-ink",
                            )}>
                                {format(day, "d")}
                            </span>
                            {ins.map((r) => <MovementChip key={`in-${r.id}`} kind="checkin" reservation={r} />)}
                            {outs.map((r) => <MovementChip key={`out-${r.id}`} kind="checkout" reservation={r} />)}
                        </li>
                    )
                })}
            </ul>
        </Surface>
    )
}

function MovementChip({ kind, reservation }: { kind: MovementKind; reservation: Reservation }) {
    return (
        <Link
            href={reservationHref(reservation.id)}
            {...prefetchProps(reservation.id)}
            aria-label={`${MOVEMENT_LABEL[kind]} · ${guestText(reservation)} · ${reservation.unitName}`}
            className="flex min-w-0 items-center gap-1.5 rounded-md border border-rule bg-card px-1 py-0.5 text-xs text-ink transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
            <MovementMark kind={kind} size="sm" />
            <span className="truncate">{guestText(reservation)}</span>
        </Link>
    )
}
