"use client"

import { format, isSameMonth } from "date-fns"
import { es } from "date-fns/locale"
import { EmptyState } from "@/components/ui/empty-state"
import { formatUsd, type MonthlyPoint } from "@/features/billing/types"
import { AnalysisHeading } from "./AnalysisHeading"

interface Props {
    /** Six months ending at `refMonth`, oldest first. */
    monthly: MonthlyPoint[]
    /** The month the rest of the Tablero is scoped to — emphasised in the plot. */
    refMonth: Date
}

/**
 * Six-month consumption history. One column per month, single series (USD), so
 * there is no legend — the panel title names the measure.
 *
 * Every value is derived from the same cost breakdowns the table below shows;
 * a month with no billed reservation is a real zero for the loaded data, drawn
 * as a baseline stub so it reads as "zero" rather than "missing".
 *
 * Es una columna del análisis del periodo (nivel 2), no una tarjeta: la carga y
 * el error los resuelve el nivel. Solo el mes elegido va en el color de marca
 * (es la selección); el resto, en neutro.
 */
export function ConsumptionHistoryChart({ monthly, refMonth }: Props) {
    const ceiling = niceCeiling(Math.max(...monthly.map((m) => m.total), 0))

    return (
        <div>
            <AnalysisHeading
                title="Historial"
                description={`6 meses hasta ${format(refMonth, "MMMM 'de' yyyy", { locale: es })} · agrupado por fecha de check-in, en USD`}
            />
            <div className="mt-4">
                {ceiling === 0 ? (
                    <EmptyState className="h-48 py-0" title="Sin consumo facturado en estos 6 meses" />
                ) : (
                    <div className="flex gap-3">
                        {/* Y axis — three recessive ticks, enough to read magnitude. */}
                        <div className="flex flex-col justify-between h-48 pb-6 text-[11px] tabular-nums text-ink-4 text-right shrink-0">
                            <span>{tick(ceiling)}</span>
                            <span>{tick(ceiling / 2)}</span>
                            <span>{tick(0)}</span>
                        </div>

                        <div className="relative flex-1 min-w-0">
                            {/* Gridlines sit behind the marks and stop at the baseline. */}
                            <div className="absolute inset-x-0 top-0 h-48 pb-6 flex flex-col justify-between pointer-events-none">
                                <div className="border-t border-rule/60" />
                                <div className="border-t border-rule/60" />
                                <div className="border-t border-rule" />
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
                                                <div className="whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-white">
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
                                                <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink">
                                                    {formatUsd(point.total)}
                                                </span>
                                            )}

                                            <div
                                                className={`w-full max-w-[3rem] rounded-t transition-colors ${
                                                    isRef
                                                        ? "bg-primary"
                                                        : "bg-ink-4/40 group-hover:bg-ink-4/70"
                                                }`}
                                                // A zero month still draws a 2px stub: present, and empty.
                                                style={{ height: `max(${heightPct}%, 2px)` }}
                                            />

                                            <span
                                                className={`absolute bottom-0 text-[11px] capitalize ${
                                                    isRef
                                                        ? "font-semibold text-ink"
                                                        : "text-ink-4"
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
        </div>
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
