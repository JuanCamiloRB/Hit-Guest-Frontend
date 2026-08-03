"use client"

import { addMonths, format, isSameMonth, startOfMonth, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
    /** First day of the month currently shown. */
    value: Date
    onChange: (month: Date) => void
}

/**
 * Month scope for the Tablero's consumption panels. Purely a client-side filter:
 * it re-slices the already-loaded cost breakdowns, it does not re-query.
 *
 * Forward navigation stops at the current month — there is no consumption to
 * show for a month that hasn't happened.
 */
export function MonthSelector({ value, onChange }: Props) {
    const currentMonth = startOfMonth(new Date())
    const atCurrentMonth = isSameMonth(value, currentMonth)
    const label = format(value, "MMMM yyyy", { locale: es })

    return (
        <div className="flex items-center gap-1 rounded-lg border bg-white px-1 py-1 shadow-sm">
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(subMonths(value, 1))}
                aria-label="Mes anterior"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize text-[var(--color-brand-navy)]">
                {label}
            </span>

            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(addMonths(value, 1))}
                disabled={atCurrentMonth}
                aria-label="Mes siguiente"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}
