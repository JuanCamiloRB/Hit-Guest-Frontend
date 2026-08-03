"use client"

import { useEffect, useMemo, useState } from "react"
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight, Loader2, LogIn, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"
import { reservationsService } from "../services/reservations-service"
import type { Reservation } from "@/types"
import { cn } from "@/lib/utils"

/** True only when both dates are valid and ordered — safe to compare per-day. */
function hasValidStay(res: Reservation): boolean {
    const { checkIn, checkOut } = res
    return (
        checkIn instanceof Date && !isNaN(checkIn.getTime()) &&
        checkOut instanceof Date && !isNaN(checkOut.getTime()) &&
        checkIn.getTime() <= checkOut.getTime()
    )
}

// Which movements to show. "both" shows arrivals + departures.
type MovementFilter = "both" | "in" | "out"

const FILTER_OPTIONS: { value: MovementFilter; label: string }[] = [
    { value: "both", label: "Ambos" },
    { value: "in", label: "Solo Check-in" },
    { value: "out", label: "Solo Checkout" },
]

/** Dropdown multi-select (checkboxes). Empty selection means "all". */
function MultiSelectFilter({
    allLabel,
    options,
    selected,
    onToggle,
    onClear,
}: {
    allLabel: string
    options: { id: string; name: string }[]
    selected: Set<string>
    onToggle: (id: string) => void
    onClear: () => void
}) {
    const triggerText =
        selected.size === 0
            ? allLabel
            : selected.size === 1
                ? options.find((o) => selected.has(o.id))?.name ?? "1 seleccionado"
                : `${selected.size} seleccionados`

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 min-w-[170px] justify-between gap-2 text-xs font-medium">
                    <span className="truncate">{triggerText}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[240px] p-1">
                <button
                    type="button"
                    onClick={onClear}
                    className={cn(
                        "w-full rounded px-2 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-slate-50",
                        selected.size === 0 ? "text-brand-purple" : "text-slate-600",
                    )}
                >
                    {allLabel}
                </button>
                <div className="mt-0.5 max-h-64 overflow-y-auto border-t border-slate-100 pt-1">
                    {options.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-400">Sin opciones</p>
                    ) : (
                        options.map((o) => (
                            <label
                                key={o.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                <Checkbox checked={selected.has(o.id)} onCheckedChange={() => onToggle(o.id)} />
                                <span className="truncate">{o.name}</span>
                            </label>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function ReservationsCalendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<MovementFilter>("both")
    // Empty set = "all". Multi-select: pick several properties / alojamientos.
    const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set())
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())

    useEffect(() => {
        let mounted = true
        reservationsService.list()
            .then((data) => { if (mounted) setReservations(data.filter(hasValidStay)) })
            .catch(() => { if (mounted) setReservations([]) })
            .finally(() => { if (mounted) setIsLoading(false) })
        return () => { mounted = false }
    }, [])

    // Only offer properties/units actually present in the loaded data.
    const propertyOptions = useMemo(() => {
        const map = new Map<string, string>()
        reservations.forEach((r) => { if (r.propertyId) map.set(r.propertyId, r.propertyName) })
        return Array.from(map, ([id, name]) => ({ id, name }))
    }, [reservations])

    // Alojamientos narrow to the SELECTED properties (all when none selected), so
    // the second filter never offers units that don't belong to the chosen ones.
    const unitOptions = useMemo(() => {
        const map = new Map<string, string>()
        reservations
            .filter((r) => selectedProperties.size === 0 || (r.propertyId && selectedProperties.has(r.propertyId)))
            .forEach((r) => { if (r.unitId) map.set(r.unitId, r.unitName) })
        return Array.from(map, ([id, name]) => ({ id, name }))
    }, [reservations, selectedProperties])

    const toggleProperty = (id: string) => {
        const next = new Set(selectedProperties)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelectedProperties(next)
        // Prune selected units that no longer belong to the selected properties.
        if (next.size > 0) {
            const allowed = new Set(
                reservations.filter((r) => r.propertyId && next.has(r.propertyId)).map((r) => r.unitId),
            )
            setSelectedUnits((prev) => new Set([...prev].filter((u) => allowed.has(u))))
        }
    }

    const toggleUnit = (id: string) => {
        const next = new Set(selectedUnits)
        next.has(id) ? next.delete(id) : next.add(id)
        setSelectedUnits(next)
    }

    const visibleReservations = useMemo(
        () =>
            reservations.filter((r) => {
                if (selectedProperties.size > 0 && !(r.propertyId && selectedProperties.has(r.propertyId))) return false
                if (selectedUnits.size > 0 && !(r.unitId && selectedUnits.has(r.unitId))) return false
                return true
            }),
        [reservations, selectedProperties, selectedUnits],
    )

    const startDate = startOfWeek(startOfMonth(currentMonth))
    const endDate = endOfWeek(endOfMonth(currentMonth))

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
    const today = () => setCurrentMonth(new Date())

    const showIns = filter !== "out"
    const showOuts = filter !== "in"

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                    {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={today}>Today</Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Legend + filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-100 text-emerald-600">
                            <LogIn size={11} />
                        </span>
                        Entrada (Check-in)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-100 text-amber-600">
                            <LogOut size={11} />
                        </span>
                        Salida (Checkout)
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <MultiSelectFilter
                        allLabel="Todas las propiedades"
                        options={propertyOptions}
                        selected={selectedProperties}
                        onToggle={toggleProperty}
                        onClear={() => { setSelectedProperties(new Set()); setSelectedUnits(new Set()) }}
                    />

                    <MultiSelectFilter
                        allLabel="Todos los alojamientos"
                        options={unitOptions}
                        selected={selectedUnits}
                        onToggle={toggleUnit}
                        onClear={() => setSelectedUnits(new Set())}
                    />

                    <div className="inline-flex rounded-lg bg-muted p-0.5">
                        {FILTER_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFilter(opt.value)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                                    filter === opt.value
                                        ? "bg-background text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="relative grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                        <Loader2 className="h-6 w-6 animate-spin text-brand-purple" />
                    </div>
                )}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="bg-background p-2 text-center text-sm font-semibold">
                        {day}
                    </div>
                ))}

                {days.map((day) => {
                    const checkIns = showIns
                        ? visibleReservations.filter((res) => isSameDay(day, res.checkIn))
                        : []
                    const checkOuts = showOuts
                        ? visibleReservations.filter((res) => isSameDay(day, res.checkOut))
                        : []

                    return (
                        <div
                            key={day.toString()}
                            className={cn(
                                "bg-background min-h-[100px] p-2 flex flex-col space-y-1 hover:bg-muted/50 transition-colors",
                                !isSameMonth(day, currentMonth) && "text-muted-foreground bg-muted/20"
                            )}
                        >
                            <span className={cn(
                                "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                isSameDay(day, new Date()) && "bg-primary text-primary-foreground"
                            )}>
                                {format(day, "d")}
                            </span>

                            {checkIns.map((res) => (
                                <Link
                                    key={`in-${res.id}`}
                                    href={`/dashboard/reservations/${res.id}`}
                                    className="flex items-center gap-1 text-xs truncate bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.5 rounded cursor-pointer hover:bg-emerald-100"
                                    title={`Entrada · ${res.guestName} · ${res.propertyName}`}
                                >
                                    <LogIn size={11} className="shrink-0" />
                                    <span className="truncate">{res.guestName}</span>
                                </Link>
                            ))}

                            {checkOuts.map((res) => (
                                <Link
                                    key={`out-${res.id}`}
                                    href={`/dashboard/reservations/${res.id}`}
                                    className="flex items-center gap-1 text-xs truncate bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded cursor-pointer hover:bg-amber-100"
                                    title={`Salida · ${res.guestName} · ${res.propertyName}`}
                                >
                                    <LogOut size={11} className="shrink-0" />
                                    <span className="truncate">{res.guestName}</span>
                                </Link>
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
