"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { formatUsd, type ConsumptionSummary } from "@/features/billing/types"
import { Heading } from "@/components/ui/heading"

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
            // Banda plana con el morado de interacción al 5 %: una unidad entre las
            // dos superficies, sin borde ni sombra. Los divisores son `rule`.
            className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg bg-primary/5 px-4 py-3 text-sm text-ink-2 sm:[&>p]:border-l sm:[&>p]:border-rule sm:[&>p]:pl-6"
        >
            <Heading level={2} size="section" tone="muted" className="w-full sm:w-auto" id="account-history-title">
                Desde el inicio de la cuenta
            </Heading>
            {isLoading ? (
                <Skeleton className="h-4 w-72" />
            ) : (
                <>
                    <p>
                        <span className="font-sans text-lg font-bold tabular-nums text-brand-navy">
                            {lifetime ? lifetime.processedReservations : "—"}
                        </span>{" "}
                        reservas con consumo facturado
                    </p>
                    <p>
                        <span className="font-sans text-lg font-bold tabular-nums text-brand-navy">
                            {lifetime?.avgPerReservation != null ? formatUsd(lifetime.avgPerReservation) : "—"}
                        </span>{" "}
                        promedio por reserva facturada
                    </p>
                </>
            )}
        </section>
    )
}
