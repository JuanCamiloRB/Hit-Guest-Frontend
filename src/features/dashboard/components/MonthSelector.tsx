"use client"

import { addMonths, format, isSameMonth, startOfMonth, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSyncExternalStore } from "react"
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
 *
 * `/dashboard` es una ruta estática: su HTML sale del build, con la fecha del
 * build. El mes depende del reloj del navegador, así que se pinta después de
 * hidratar; antes, un bloque del mismo ancho. Si no, abrir un despliegue de
 * otro mes rompe la hidratación (React #418).
 */
const subscribeNever = () => () => {}

export function MonthSelector({ value, onChange }: Props) {
    const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false)
    const currentMonth = startOfMonth(new Date())
    const atCurrentMonth = isSameMonth(value, currentMonth)
    const label = format(value, "MMMM yyyy", { locale: es })

    return (
        <div className="flex items-center gap-1 rounded-lg border border-rule bg-card p-0.5">
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(subMonths(value, 1))}
                aria-label="Mes anterior"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-[8.5rem] text-center text-sm font-semibold capitalize text-ink">
                {hydrated ? label : <span aria-hidden className="inline-block h-4 w-24 animate-pulse rounded-md bg-accent align-middle" />}
            </span>

            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(addMonths(value, 1))}
                disabled={!hydrated || atCurrentMonth}
                aria-label="Mes siguiente"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}
