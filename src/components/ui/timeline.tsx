"use client"

import * as React from "react"
import Link from "next/link"
import { format, isSameDay, isWeekend } from "date-fns"
import { es } from "date-fns/locale"

import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Surface } from "./card"
import { MovementMark, MOVEMENT_LABEL } from "./movement-mark"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"
import { UnstyledButton } from "./unstyled-button"

/**
 * El tablero de ocupación: una fila por recurso (un alojamiento) y una columna
 * por día; cada estadía es una barra que va de su check-in a su checkout.
 *
 * - Encabezado: los días sobre `table-head`; el fin de semana en
 *   `table-head-accent` con texto `primary-hover`; hoy en `primary` con texto
 *   blanco. La columna de recursos, fija a la izquierda, en `table-head-accent`.
 * - Carriles: el fin de semana `primary/5`, hoy `primary/10`; divisor `rule`.
 * - `TimelineBar`: la barra morada, con la marca de check-in y la de checkout
 *   en sus extremos (`MovementMark bordered`). Con mouse es un ENLACE a la
 *   reserva y el detalle va en un `Tooltip` al pasar o enfocar. En táctil (un
 *   puntero sin hover) es un botón: el primer toque abre el detalle en un
 *   `Popover` con «Ver reserva»; así una estadía corta, que solo muestra las
 *   marcas, también se puede leer antes de entrar.
 *
 * Las posiciones van en DÍAS desde el primero de la vista: `start` 0.5 es el
 * centro del primer día. Así una barra «termina en la fecha de checkout» y
 * dos estadías seguidas (sale una, entra otra el mismo día) no se pisan.
 */

const DAY_REM = 3.75 // 60 px por día: el ancho mínimo antes de desplazar de lado.
/** Sin hover (táctil): el detalle se abre al tocar, no al pasar. */
const TOUCH_QUERY = "(hover: none)"
const TRACK_PX = 44 // Alto de un carril: barra de 36 + 8 de aire.
const ROW_PAD_PX = 14

interface TimelineContextValue {
    days: readonly Date[]
    today: Date
    /** Puntero sin hover (táctil): una sola consulta para todo el tablero, no una por barra. */
    touch: boolean
}
const TimelineContext = React.createContext<TimelineContextValue | null>(null)
function useTimeline(): TimelineContextValue {
    const ctx = React.useContext(TimelineContext)
    if (!ctx) throw new Error("TimelineRow y TimelineBar van dentro de Timeline")
    return ctx
}

/**
 * La columna de recursos: 240 px, pero nunca más del 38 % de la ventana. A
 * 375 px ocupaba 240 de 342 y dejaba ver un día; así deja ver tres.
 */
const RESOURCE_COLUMN = "min(15rem, 38vw)"
function columns(days: number): React.CSSProperties {
    return { gridTemplateColumns: `${RESOURCE_COLUMN} minmax(${days * DAY_REM}rem, 1fr)` }
}
function dayColumns(days: number): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${days}, minmax(${DAY_REM}rem, 1fr))` }
}

interface TimelineProps {
    days: readonly Date[]
    /** Por omisión, el día de hoy del navegador. */
    today?: Date
    /** El rótulo de la columna de recursos («8 alojamientos»). */
    resourceLabel: React.ReactNode
    /** Nombre de la región para lectores de pantalla. */
    label: string
    /** El pie: a la izquierda cuántos se muestran, a la derecha una nota. */
    footer?: React.ReactNode
    footerNote?: React.ReactNode
    children: React.ReactNode
    className?: string
}

function Timeline({ days, today = new Date(), resourceLabel, label, footer, footerNote, children, className }: TimelineProps) {
    const touch = useMediaQuery(TOUCH_QUERY)
    const value = React.useMemo(() => ({ days, today, touch }), [days, today, touch])
    return (
        <TimelineContext.Provider value={value}>
            <TooltipProvider delayDuration={150}>
                <Surface as="section" aria-label={label} data-slot="timeline" className={cn("overflow-hidden", className)}>
                    <div className="overflow-x-auto">
                        {/* Encabezado visual: cada barra ya dice sus fechas en su nombre accesible. */}
                        <div className="grid border-b border-rule" style={columns(days.length)} aria-hidden="true">
                            <div data-slot="timeline-resource-head" className="sticky left-0 z-20 flex items-center border-r border-rule bg-table-head-accent px-4 text-xs font-semibold text-ink">
                                {resourceLabel}
                            </div>
                            <div className="grid bg-table-head" style={dayColumns(days.length)}>
                                {days.map((day) => <TimelineDayHead key={day.toISOString()} day={day} today={today} />)}
                            </div>
                        </div>
                        <ul data-slot="timeline-rows">{children}</ul>
                    </div>
                    {(footer || footerNote) && (
                        <div data-slot="timeline-footer" className="flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-sunk/50 px-4 py-3 text-xs text-ink-2">
                            <span>{footer}</span>
                            {footerNote && <span className="text-ink-3">{footerNote}</span>}
                        </div>
                    )}
                </Surface>
            </TooltipProvider>
        </TimelineContext.Provider>
    )
}

function TimelineDayHead({ day, today }: { day: Date; today: Date }) {
    const isToday = isSameDay(day, today)
    const weekend = isWeekend(day)
    return (
        <div
            data-slot="timeline-day"
            data-today={isToday || undefined}
            data-weekend={weekend || undefined}
            className={cn(
                "flex min-h-13 flex-col items-center justify-center border-r border-rule py-1.5 last:border-r-0",
                isToday ? "bg-primary text-primary-foreground" : weekend ? "bg-table-head-accent text-primary-hover" : "text-ink-2",
            )}
        >
            <span className="text-xs font-medium">{format(day, "EEE", { locale: es })}</span>
            <span className={cn("text-sm font-semibold tabular-nums", !isToday && !weekend && "text-ink")}>{format(day, "d")}</span>
        </div>
    )
}

interface TimelineRowProps {
    title: string
    subtitle?: string
    /** Carriles de la fila: más de uno solo si dos estadías se cruzan. */
    tracks?: number
    children?: React.ReactNode
}

function TimelineRow({ title, subtitle, tracks = 1, children }: TimelineRowProps) {
    const { days, today } = useTimeline()
    const height = ROW_PAD_PX * 2 + 36 + (Math.max(1, tracks) - 1) * TRACK_PX
    return (
        <li data-slot="timeline-row" className="grid border-b border-rule last:border-b-0" style={columns(days.length)}>
            <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-rule bg-card px-4 py-2">
                <span className="truncate text-sm font-semibold text-ink">{title}</span>
                {subtitle && <span className="truncate text-xs text-ink-3">{subtitle}</span>}
            </div>
            <div className="relative grid" style={{ ...dayColumns(days.length), minHeight: height }}>
                {days.map((day) => (
                    <div
                        key={day.toISOString()}
                        aria-hidden="true"
                        className={cn(
                            "border-r border-rule last:border-r-0",
                            isSameDay(day, today) ? "bg-primary/10" : isWeekend(day) && "bg-primary/5",
                        )}
                    />
                ))}
                {children}
            </div>
        </li>
    )
}

interface TimelineBarProps {
    /** Inicio y fin en días desde el primero de la vista (0.5 = centro del primer día). */
    start: number
    end: number
    /** El carril dentro de la fila (0 = el primero). */
    track?: number
    href: string
    /** El nombre accesible completo: quién, dónde y las dos fechas. */
    label: string
    /** La marca de check-in o de checkout solo si ese día está en la vista. */
    checkin?: boolean
    checkout?: boolean
    /** El detalle al pasar o enfocar: un título y pares rótulo / valor. */
    detailTitle: string
    details: readonly (readonly [string, string])[]
    /** Eventos del enlace (precargar la reserva al pasar por encima). */
    linkProps?: Omit<React.ComponentProps<typeof Link>, "href" | "children" | "className" | "style" | "aria-label">
    children: React.ReactNode
}

const BAR_CLASSES = cn(
    "absolute z-1 flex h-9 min-w-0 items-center gap-1.5 overflow-hidden rounded-lg bg-primary px-1.5 text-left text-xs font-semibold text-primary-foreground shadow-sm transition-colors",
    "hover:bg-primary-hover outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "data-[state=open]:bg-primary-hover",
)

/** El detalle de la estadía: oscuro en el Tooltip, claro en el Popover táctil. */
function StayDetail({ title, details, tone }: { title: string; details: TimelineBarProps["details"]; tone: "dark" | "light" }) {
    return (
        <>
            <p className={cn("mb-2 text-xs font-semibold", tone === "dark" ? "text-white" : "text-ink")}>{title}</p>
            <dl className="space-y-1 text-xs">
                {details.map(([term, value]) => (
                    <div key={term} className="flex gap-3">
                        <dt className={cn("w-20 shrink-0 font-normal", tone === "dark" ? "text-ink-4" : "text-ink-3")}>{term}</dt>
                        <dd className={cn("min-w-0 font-medium", tone === "dark" ? "text-white" : "text-ink")}>{value}</dd>
                    </div>
                ))}
            </dl>
        </>
    )
}

function TimelineBar({ start, end, track = 0, href, label, checkin = false, checkout = false, detailTitle, details, linkProps, children }: TimelineBarProps) {
    const { days, touch } = useTimeline()
    const n = days.length
    // Una noche (un día de ancho) no deja lugar al texto: quedan las marcas, más chicas.
    // Menos de un día (medio día: solo se ve un extremo) deja 22 px a 60 px por
    // día: una sola marca de 20, sin relleno. Ahí nunca hay dos: la estadía que
    // entra y sale el mismo día ocupa el día entero (lib/occupancy).
    const compact = end - start < 1.5
    const tiny = end - start < 1
    const style: React.CSSProperties = {
        left: `calc(${start} * 100% / ${n} + 4px)`,
        width: `calc(${end - start} * 100% / ${n} - 8px)`,
        top: ROW_PAD_PX + track * TRACK_PX,
    }
    const body = (
        <>
            {checkin && <MovementMark kind="checkin" bordered size={compact ? "sm" : "md"} />}
            {!compact && <span className="min-w-0 flex-1 truncate">{children}</span>}
            {checkout && <MovementMark kind="checkout" bordered size={compact ? "sm" : "md"} className={cn(!compact && "ml-auto")} />}
        </>
    )
    const shared = {
        "data-slot": "timeline-bar",
        "data-compact": compact || undefined,
        "data-tiny": tiny || undefined,
        style,
        className: cn(BAR_CLASSES, compact && "justify-between gap-0.5 px-1", tiny && "justify-center px-0"),
    }

    if (touch) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <UnstyledButton type="button" {...shared} data-touch="true" aria-label={`${label}. Ver detalle`}>
                        {body}
                    </UnstyledButton>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-72 p-3">
                    <StayDetail title={detailTitle} details={details} tone="light" />
                    <Button asChild size="sm" className="mt-3 w-full">
                        <Link {...linkProps} href={href}>Ver reserva</Link>
                    </Button>
                </PopoverContent>
            </Popover>
        )
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link {...linkProps} {...shared} href={href} aria-label={label}>
                    {body}
                </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-72 p-3">
                <StayDetail title={detailTitle} details={details} tone="dark" />
            </TooltipContent>
        </Tooltip>
    )
}

/**
 * La leyenda del tablero: las dos marcas y la barra, con las mismas formas y
 * colores. `stay={false}` donde no hay barras (la vista Mes): solo las marcas.
 */
function TimelineLegend({ stay = true, className }: { stay?: boolean; className?: string }) {
    return (
        <ul data-slot="timeline-legend" aria-label="Leyenda" className={cn("flex flex-wrap items-center gap-4 text-xs font-medium text-ink-2", className)}>
            <li className="inline-flex items-center gap-1.5"><MovementMark kind="checkin" />{MOVEMENT_LABEL.checkin}</li>
            {stay && <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-6 rounded-full bg-primary" />Estadía</li>}
            <li className="inline-flex items-center gap-1.5"><MovementMark kind="checkout" />{MOVEMENT_LABEL.checkout}</li>
        </ul>
    )
}

export { Timeline, TimelineRow, TimelineBar, TimelineLegend, type TimelineBarProps }
