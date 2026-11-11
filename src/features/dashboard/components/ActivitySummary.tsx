"use client"

import { format, isSameYear, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { TrendingDown, TrendingUp } from "lucide-react"
import { formatUsd, type ConsumptionSummary } from "@/features/billing/types"

/**
 * La cifra protagonista del nivel 2: el consumo facturado del mes elegido, con
 * su variación en línea. Por fecha de check-in, el criterio del tablero.
 */
export function ActivitySummary({ summary, refMonth }: { summary: ConsumptionSummary; refMonth: Date }) {
    return (
        <div>
            <p className="text-sm font-medium text-ink-3">Consumo facturado</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-3xl font-semibold leading-tight tracking-tight tabular-nums text-ink">
                    {formatUsd(summary.monthTotal)}
                </span>
                <MonthDeltaLine summary={summary} refMonth={refMonth} />
            </div>
            <p className="mt-1 text-sm text-ink-3">
                Reservas con check-in en {format(refMonth, "MMMM 'de' yyyy", { locale: es })}
            </p>
        </div>
    )
}

/** Por debajo de esto (0,05 %) el cambio es ruido de redondeo: «sin cambio». */
const FLAT_THRESHOLD = 0.0005

const percent = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 })

/**
 * ¿El mes elegido consumió más o menos que el anterior? Sigue al selector.
 * Subir es la mala noticia para quien paga, así que sube en rojo y baja en
 * verde. Sin consumo el mes anterior no hay base: se dice, sin inventar un %.
 */
export function MonthDeltaLine({ summary, refMonth }: { summary: ConsumptionSummary; refMonth: Date }) {
    const prevMonth = subMonths(refMonth, 1)
    // El año solo cuando cambia (enero vs diciembre del año anterior).
    const prevLabel = format(prevMonth, isSameYear(prevMonth, refMonth) ? "MMMM" : "MMMM yyyy", { locale: es })

    if (summary.monthDeltaPct === null) {
        return <p className="text-sm text-ink-3">Sin consumo en {prevLabel} para comparar</p>
    }
    if (Math.abs(summary.monthDeltaPct) < FLAT_THRESHOLD) {
        return <p className="text-sm text-ink-3">Sin cambio vs {prevLabel}</p>
    }
    const rising = summary.monthDeltaPct > 0
    const Icon = rising ? TrendingUp : TrendingDown
    return (
        <p
            className="flex items-center gap-1.5 text-sm text-ink-3"
            title={`Consumo de ${format(refMonth, "MMMM yyyy", { locale: es })}: ${formatUsd(summary.monthTotal)}; ${format(prevMonth, "MMMM yyyy", { locale: es })}: ${formatUsd(summary.prevMonthTotal)}`}
        >
            <span className="sr-only">{rising ? "Sube" : "Baja"}</span>
            <span className={`inline-flex items-center gap-0.5 font-semibold ${rising ? "text-danger" : "text-success"}`}>
                <Icon className="h-4 w-4" aria-hidden />
                {rising ? "+" : "−"}{percent.format(Math.abs(summary.monthDeltaPct) * 100)} %
            </span>
            <span>vs {prevLabel}</span>
        </p>
    )
}
