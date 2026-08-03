"use client"

import { format, isSameMonth } from "date-fns"
import { es } from "date-fns/locale"
import { SectionCard } from "@/components/ui/section-card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { formatUsd, type MonthlyPoint } from "@/features/billing/types"

interface Props {
    /** Six months ending at `refMonth`, oldest first. */
    monthly: MonthlyPoint[]
    /** The month the rest of the Tablero is scoped to — emphasised in the plot. */
    refMonth: Date
    isLoading: boolean
}

/**
 * Six-month consumption history. One column per month, single series (USD), so
 * there is no legend — the panel title names the measure.
 *
 * Every value is derived from the same cost breakdowns the table below shows;
 * a month with no billed reservation is a real zero for the loaded data, drawn
 * as a baseline stub so it reads as "zero" rather than "missing".
 */
export function ConsumptionHistoryChart({ monthly, refMonth, isLoading }: Props) {
    const ceiling = niceCeiling(Math.max(...monthly.map((m) => m.total), 0))

    return (
        <SectionCard title="Historial de consumo" description="Últimos 6 meses, en USD">
            <div>
                {isLoading ? (
                    <LoadingState variant="spinner" className="h-56" label="Cargando historial" />
                ) : ceiling === 0 ? (
                    <EmptyState
                        className="h-56 py-0"
                        title="Sin consumo registrado en estos 6 meses"
                        description="Las automatizaciones facturadas aparecerán aquí."
                    />
                ) : (
                    <div className="flex gap-3">
                        {/* Y axis — three recessive ticks, enough to read magnitude. */}
                        <div className="flex flex-col justify-between h-48 pb-6 text-[10px] tabular-nums text-slate-400 text-right shrink-0">
                            <span>{tick(ceiling)}</span>
                            <span>{tick(ceiling / 2)}</span>
                            <span>{tick(0)}</span>
                        </div>

                        <div className="relative flex-1 min-w-0">
                            {/* Gridlines sit behind the marks and stop at the baseline. */}
                            <div className="absolute inset-x-0 top-0 h-48 pb-6 flex flex-col justify-between pointer-events-none">
                                <div className="border-t border-slate-100" />
                                <div className="border-t border-slate-100" />
                                <div className="border-t border-slate-200" />
                            </div>

                            <div className="relative flex items-end justify-between gap-2 h-48">
                                {monthly.map((point) => {
                                    const isRef = isSameMonth(point.date, refMonth)
                                    // Reserve the 24px label strip under the baseline.
                                    const heightPct = (point.total / ceiling) * 100

                                    return (
                                        <div
                                            key={point.date.toISOString()}
                                            className="group relative flex-1 flex flex-col justify-end items-center h-full pb-6"
                                        >
                                            {/* Tooltip — hit target is the whole column. */}
                                            <div className="pointer-events-none absolute bottom-full mb-1 z-10 hidden group-hover:block">
                                                <div className="whitespace-nowrap rounded-md bg-[var(--color-brand-navy)] px-2 py-1 text-[11px] font-medium text-white shadow-lg">
                                                    <span className="capitalize">
                                                        {format(point.date, "MMMM yyyy", { locale: es })}
                                                    </span>
                                                    <span className="mx-1 text-white/40">·</span>
                                                    <span className="tabular-nums">
                                                        {formatUsd(point.total)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Direct label on the scoped month only — never every bar. */}
                                            {isRef && point.total > 0 && (
                                                <span className="mb-1 text-[10px] font-bold tabular-nums text-[var(--color-brand-navy)]">
                                                    {formatUsd(point.total)}
                                                </span>
                                            )}

                                            <div
                                                className={`w-full max-w-[3rem] rounded-t transition-colors ${
                                                    isRef
                                                        ? "bg-[var(--color-brand-purple)]"
                                                        : "bg-[var(--color-brand-purple)]/35 group-hover:bg-[var(--color-brand-purple)]/60"
                                                }`}
                                                // A zero month still draws a 2px stub: present, and empty.
                                                style={{ height: `max(${heightPct}%, 2px)` }}
                                            />

                                            <span
                                                className={`absolute bottom-0 text-[10px] capitalize ${
                                                    isRef
                                                        ? "font-bold text-[var(--color-brand-navy)]"
                                                        : "text-slate-400"
                                                }`}
                                            >
                                                {format(point.date, "MMM", { locale: es })}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    )
}

/**
 * Axis tick: the bare number. The currency lives in the panel subtitle, so
 * repeating "USD" on every tick would just be noise next to the plot.
 */
function tick(value: number): string {
    return value.toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

/**
 * Round a maximum up to a readable axis ceiling (1, 2, 2.5, 5 or 10 × 10ⁿ), so
 * the two intermediate ticks land on numbers a person can divide in their head.
 */
function niceCeiling(value: number): number {
    if (value <= 0) return 0
    const magnitude = 10 ** Math.floor(Math.log10(value))
    const normalized = value / magnitude
    const step =
        normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
    return step * magnitude
}
