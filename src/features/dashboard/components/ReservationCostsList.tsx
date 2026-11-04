"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/ui/section-card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Search } from "lucide-react"
import { COST_CATEGORIES } from "@/features/billing/lib/pricing"
import { formatUsd, type ReservationCost, type ReservationCostFailure } from "@/features/billing/types"

interface Props {
    costs: ReservationCost[]
    /** Reservas cuyo consumo no se pudo consultar: fila propia, sin montos. */
    failedReservations?: ReservationCostFailure[]
    isLoading: boolean
    /** No hay datos confiables (error de carga): ni filas ni «sin consumo». */
    unavailable?: boolean
    /** Carga inicial en curso: `costs` trae lo que ya llegó y esto, cuánto falta. */
    loadingProgress?: { done: number; total: number } | null
}

/** Filas que se pintan de entrada; «Mostrar más» agrega otras tantas. */
export const ROWS_PER_STEP = 25

function matches(row: { guestName: string; unitName: string; propertyName: string }, q: string): boolean {
    return (
        row.guestName.toLowerCase().includes(q) ||
        row.unitName.toLowerCase().includes(q) ||
        row.propertyName.toLowerCase().includes(q)
    )
}

function initials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
}

/**
 * Per-reservation consumption breakdown. One row per reservation with a column
 * per billable automation (Verificación, Contrato, TRA, SIRE, Accesos) plus the
 * total — the dashboard's answer to "how much did each reservation cost?".
 * Amounts come from real usage records; a category that didn't run shows "—".
 * Una reserva cuya consulta falló va arriba como «Consumo no disponible»: un
 * fallo no se muestra como una fila en 0 USD.
 */
export function ReservationCostsList({
    costs,
    failedReservations = [],
    isLoading,
    unavailable = false,
    loadingProgress = null,
}: Props) {
    const [query, setQuery] = useState("")
    // El DOM no crece con la cuenta: se pintan de a ROWS_PER_STEP, y una
    // búsqueda nueva vuelve al primer tramo.
    const [shown, setShown] = useState(ROWS_PER_STEP)
    const search = (value: string) => {
        setQuery(value)
        setShown(ROWS_PER_STEP)
    }

    const { filtered, failed } = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return { filtered: costs, failed: failedReservations }
        return {
            filtered: costs.filter((c) => matches(c, q)),
            failed: failedReservations.filter((f) => matches(f, q)),
        }
    }, [costs, failedReservations, query])

    return (
        <SectionCard
            flush
            title="Detalle por reserva"
            className="shadow-none"
            description="Desglose de las reservas cargadas, con o sin consumo facturado."
            actions={
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                    <Input
                        placeholder="Buscar huésped, alojamiento…"
                        value={query}
                        onChange={(e) => search(e.target.value)}
                        className="pl-9 h-9"
                        aria-label="Buscar en el consumo por reserva"
                    />
                </div>
            }
        >
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-medium text-ink-3">
                                Huésped / Alojamiento
                            </TableHead>
                            {COST_CATEGORIES.map((c) => (
                                <TableHead
                                    key={c.key}
                                    className="text-right text-xs font-medium text-ink-3"
                                >
                                    {c.label}
                                </TableHead>
                            ))}
                            <TableHead className="text-right text-xs font-semibold text-ink">
                                Total
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && costs.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={COST_CATEGORIES.length + 2} className="p-0">
                                    <LoadingState rows={4} label="Cargando consumo por reserva" />
                                </TableCell>
                            </TableRow>
                        ) : unavailable ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={COST_CATEGORIES.length + 2} className="p-0">
                                    <EmptyState title="Consumo no disponible" />
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 && failed.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={COST_CATEGORIES.length + 2} className="p-0">
                                    <EmptyState
                                        title={
                                            query
                                                ? "Ninguna reserva coincide con la búsqueda"
                                                : "Todavía no hay reservas para mostrar"
                                        }
                                        description={
                                            query
                                                ? "Prueba con otro nombre de huésped o alojamiento."
                                                : "Las reservas de la cuenta aparecerán aquí, con o sin consumo."
                                        }
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                            {failed.map((f) => (
                                <TableRow
                                    key={f.reservationId}
                                    className="bg-warning-sunk/40 hover:bg-warning-sunk/60"
                                >
                                    <TableCell>
                                        <GuestCell guestName={f.guestName} unitName={f.unitName} />
                                    </TableCell>
                                    <TableCell
                                        colSpan={COST_CATEGORIES.length + 1}
                                        className="text-right text-xs font-semibold text-warning"
                                    >
                                        Consumo no disponible
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filtered.slice(0, shown).map((c) => (
                                <TableRow
                                    key={c.reservationId}
                                    className="hover:bg-sunk/50"
                                >
                                    <TableCell>
                                        <GuestCell guestName={c.guestName} unitName={c.unitName} />
                                    </TableCell>
                                    {c.lineItems.map((item) => (
                                        <TableCell
                                            key={item.category}
                                            className={`text-right text-sm tabular-nums ${
                                                item.consumed
                                                    ? "font-medium text-ink-2"
                                                    : "text-ink-4"
                                            }`}
                                        >
                                            {/* Tres estados, no dos: facturó (monto), corrió gratis
                                                ("Sin cargo": la firma nativa) o no corrió ("—").
                                                El "—" para una firma ejecutada se leía como plata
                                                perdida. */}
                                            {item.consumed
                                                ? formatUsd(item.amount)
                                                : item.freeCount > 0
                                                    ? <span className="text-xs font-medium text-ink-3">Sin cargo</span>
                                                    : "—"}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-semibold text-ink tabular-nums">
                                        {formatUsd(c.total)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>
            {(isLoading && loadingProgress) || filtered.length > shown ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-2 sm:px-6">
                    {filtered.length > shown ? (
                        <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + ROWS_PER_STEP)}>
                            Mostrar más ({filtered.length - shown} restantes)
                        </Button>
                    ) : <span />}
                    {isLoading && loadingProgress && (
                        <p role="status" className="py-1 text-[13px] text-ink-3">
                            Cargando el consumo · {loadingProgress.done} de {loadingProgress.total} reservas
                        </p>
                    )}
                </div>
            ) : null}
        </SectionCard>
    )
}

function GuestCell({ guestName, unitName }: { guestName: string; unitName: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-sunk text-ink-2 flex items-center justify-center text-xs font-semibold">
                {initials(guestName)}
            </div>
            <div className="min-w-0">
                <p className="font-medium text-ink truncate">
                    {guestName}
                </p>
                <p className="text-xs text-ink-3 truncate">
                    {unitName}
                </p>
            </div>
        </div>
    )
}
