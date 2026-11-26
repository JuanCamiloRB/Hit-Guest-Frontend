"use client"

import * as React from "react"
import Link from "next/link"
import { cva } from "class-variance-authority"
import { format, isSameDay, isWeekend } from "date-fns"
import { es } from "date-fns/locale"
import { Check, CircleHelp, Clock, TriangleAlert, type LucideIcon } from "lucide-react"

import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Surface } from "./card"
import { Icon } from "./icon"
import { MovementMark, MOVEMENT_LABEL } from "./movement-mark"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { StatusPill, type StatusTone } from "./status-pill"
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
 * - `TimelineBar`: la barra de la estadía, con la marca de check-in y la de
 *   checkout en sus extremos (`MovementMark bordered`). El lila dice
 *   «ocupado»; el estado cambia el TRAZO (`tone`): sólida, rayada, punteada o
 *   tramada, cada una con su ícono; solo la finalizada cambia de tono, a un
 *   verde muy suave («terminó bien»), que no compite con la marca sólida de
 *   check-in. Así el estado no depende solo del color. Con mouse es un ENLACE a la
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
    /** El trazo según el estado de la estadía (ver `barToneVariants`). */
    tone?: TimelineBarTone
    /** El estado con su nombre y su tono de `StatusPill`: va en el detalle y en el nombre accesible. */
    status?: { label: string; tone: StatusTone }
    /** El detalle al pasar o enfocar: un título y pares rótulo / valor. */
    detailTitle: string
    details: readonly (readonly [string, string])[]
    /** Eventos del enlace (precargar la reserva al pasar por encima). */
    linkProps?: Omit<React.ComponentProps<typeof Link>, "href" | "children" | "className" | "style" | "aria-label">
    children: React.ReactNode
}

/**
 * El trazo de cada estado. Solo fondo, borde y texto: lo comparten la barra y
 * la muestra de la leyenda. Contraste del texto (globals-contrast.test.ts):
 * - default: ink sobre el lila `timeline-bar`, borde `primary/30` (2026-11-26:
 *   el primary sólido se veía muy fuerte).
 * - progress: ink sobre las rayas `timeline-bar` / `timeline-bar-strong`.
 * - past: `success` sobre `success-sunk`; terminó bien y no compite con lo que viene.
 * - attention: ink sobre card con borde punteado primary; pide mirarla.
 * - unknown: ink-2 sobre el tramado sunk / rule; no se afirma nada.
 */
const barToneVariants = cva("", {
    variants: {
        tone: {
            default: "border border-primary/30 bg-timeline-bar text-ink",
            progress: "border border-primary/30 bg-timeline-bar pattern-progress text-ink",
            past: "border border-success/30 bg-success-sunk text-success",
            attention: "border-2 border-dashed border-primary bg-card text-ink shadow-sm",
            unknown: "border border-rule bg-sunk pattern-unknown text-ink-2",
        },
    },
    defaultVariants: { tone: "default" },
})
type TimelineBarTone = NonNullable<Parameters<typeof barToneVariants>[0]>["tone"] & string

/** El hover y el abierto de cada trazo: el fondo un paso más fuerte, sin perder el contraste. */
const BAR_HOVER: Record<TimelineBarTone, string> = {
    default: "hover:border-primary hover:bg-timeline-bar-strong data-[state=open]:border-primary data-[state=open]:bg-timeline-bar-strong",
    progress: "hover:border-primary hover:bg-timeline-bar-strong data-[state=open]:border-primary data-[state=open]:bg-timeline-bar-strong",
    past: "hover:border-success data-[state=open]:border-success",
    attention: "hover:bg-table-head-soft data-[state=open]:bg-table-head-soft",
    unknown: "hover:bg-rule data-[state=open]:bg-rule",
}

/** El ícono que acompaña al trazo, para que el estado no dependa solo de la forma. */
const BAR_ICON: Partial<Record<TimelineBarTone, { icon: LucideIcon; className?: string }>> = {
    progress: { icon: Clock, className: "text-primary-hover" },
    past: { icon: Check },
    attention: { icon: TriangleAlert, className: "text-warning" },
    unknown: { icon: CircleHelp, className: "text-ink-3" },
}

const BAR_CLASSES = cn(
    "absolute z-1 flex h-9 min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-1.5 text-left text-xs font-semibold transition-colors",
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
)

/** El detalle de la estadía: oscuro en el Tooltip, claro en el Popover táctil. */
function StayDetail({ title, details, status, tone }: { title: string; details: TimelineBarProps["details"]; status?: TimelineBarProps["status"]; tone: "dark" | "light" }) {
    return (
        <>
            <div className="mb-2 flex items-start justify-between gap-2">
                <p className={cn("min-w-0 text-xs font-semibold", tone === "dark" ? "text-white" : "text-ink")}>{title}</p>
                {status && <StatusPill tone={status.tone} className="shrink-0">{status.label}</StatusPill>}
            </div>
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

function TimelineBar({ start, end, track = 0, href, label, checkin = false, checkout = false, tone = "default", status, detailTitle, details, linkProps, children }: TimelineBarProps) {
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
    const toneIcon = BAR_ICON[tone]
    // El estado entra en el nombre accesible: el trazo y el ícono son visuales.
    const name = status ? `${label}. ${status.label}` : label
    const body = (
        <>
            {checkin && <MovementMark kind="checkin" bordered size={compact ? "sm" : "md"} />}
            {!compact && toneIcon && <Icon icon={toneIcon.icon} size="sm" data-status-icon="true" className={cn("shrink-0", toneIcon.className)} />}
            {!compact && <span className="min-w-0 flex-1 truncate">{children}</span>}
            {checkout && <MovementMark kind="checkout" bordered size={compact ? "sm" : "md"} className={cn(!compact && "ml-auto")} />}
        </>
    )
    const shared = {
        "data-slot": "timeline-bar",
        "data-compact": compact || undefined,
        "data-tiny": tiny || undefined,
        "data-tone": tone,
        style,
        className: cn(BAR_CLASSES, barToneVariants({ tone }), BAR_HOVER[tone], compact && "justify-between gap-0.5 px-1", tiny && "justify-center px-0"),
    }

    if (touch) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <UnstyledButton type="button" {...shared} data-touch="true" aria-label={`${name}. Ver detalle`}>
                        {body}
                    </UnstyledButton>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-72 p-3">
                    <StayDetail title={detailTitle} details={details} status={status} tone="light" />
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
                <Link {...linkProps} {...shared} href={href} aria-label={name}>
                    {body}
                </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-72 p-3">
                <StayDetail title={detailTitle} details={details} status={status} tone="dark" />
            </TooltipContent>
        </Tooltip>
    )
}

interface TimelineLegendTone {
    tone: TimelineBarTone
    label: string
}

/**
 * La leyenda del tablero: las dos marcas y la barra, con las mismas formas y
 * colores. `stay={false}` donde no hay barras (la vista Mes): solo las marcas.
 * `tones`: un trazo por estado, con la misma clase que la barra; sin él, una
 * sola muestra «Estadía».
 */
function TimelineLegend({ stay = true, tones, className }: { stay?: boolean; tones?: readonly TimelineLegendTone[]; className?: string }) {
    const swatches = tones ?? [{ tone: "default", label: "Estadía" }]
    return (
        <ul data-slot="timeline-legend" aria-label="Leyenda" className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-ink-2", className)}>
            <li className="inline-flex items-center gap-1.5"><MovementMark kind="checkin" />{MOVEMENT_LABEL.checkin}</li>
            <li className="inline-flex items-center gap-1.5"><MovementMark kind="checkout" />{MOVEMENT_LABEL.checkout}</li>
            {stay && swatches.map(({ tone, label }) => (
                <li key={tone} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" data-slot="timeline-legend-swatch" data-tone={tone} className={cn("h-3.5 w-7 rounded-sm", barToneVariants({ tone }))} />
                    {label}
                </li>
            ))}
        </ul>
    )
}

export { Timeline, TimelineRow, TimelineBar, TimelineLegend, type TimelineBarProps, type TimelineBarTone, type TimelineLegendTone }
