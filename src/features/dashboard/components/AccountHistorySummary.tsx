"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { formatUsd, type ConsumptionSummary } from "@/features/billing/types"

/**
 * Nivel 3, apertura: las cifras de TODA la cuenta, en una línea y fuera de la
 * superficie que gobierna el selector de mes (no dependen de él). Reservas con
 * consumo facturado = costo total > 0 (`lifetimeCostStats`); el promedio usa
 * ese mismo denominador, no todas las filas de la tabla.
 *
 * Cada dato es un bloque propio: en pantallas estrechas la línea se parte sin
 * perder significado.
 */
export function AccountHistorySummary({ summary, isLoading }: { summary: ConsumptionSummary | null; isLoading: boolean }) {
    const lifetime = summary?.lifetime

    return (
        <section
            aria-labelledby="account-history-title"
            className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-1 text-[13px] text-ink-3"
        >
            <h2 id="account-history-title" className="w-full font-secondary font-medium tracking-normal text-ink-2 sm:w-auto">
                Desde el inicio de la cuenta
            </h2>
            {isLoading ? (
                <Skeleton className="h-4 w-72" />
            ) : (
                <>
                    <p>
                        <span className="text-base font-semibold tabular-nums text-ink">
                            {lifetime ? lifetime.processedReservations : "—"}
                        </span>{" "}
                        reservas con consumo facturado
                    </p>
                    <p>
                        <span className="text-base font-semibold tabular-nums text-ink">
                            {lifetime?.avgPerReservation != null ? formatUsd(lifetime.avgPerReservation) : "—"}
                        </span>{" "}
                        promedio por reserva facturada
                    </p>
                </>
            )}
        </section>
    )
}
