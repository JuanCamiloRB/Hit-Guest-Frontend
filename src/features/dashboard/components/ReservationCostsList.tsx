"use client"

import { useMemo, useState } from "react"
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
}

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
export function ReservationCostsList({ costs, failedReservations = [], isLoading, unavailable = false }: Props) {
    const [query, setQuery] = useState("")

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
            title="Consumo por reserva"
            description="Desglose de las reservas cargadas, con o sin consumo facturado."
            actions={
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                    <Input
                        placeholder="Buscar huésped, alojamiento…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9 h-10"
                        aria-label="Buscar en el consumo por reserva"
                    />
                </div>
            }
        >
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest">
                                Huésped / Alojamiento
                            </TableHead>
                            {COST_CATEGORIES.map((c) => (
                                <TableHead
                                    key={c.key}
                                    className="text-right font-bold text-[var(--color-brand-navy)] uppercase text-[10px] tracking-widest"
                                >
                                    {c.label}
                                </TableHead>
                            ))}
                            <TableHead className="text-right font-extrabold text-[var(--color-brand-purple)] uppercase text-[10px] tracking-widest">
                                Total
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
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
                                    className="bg-amber-50/40 hover:bg-amber-50/60 border-b-[var(--color-brand-purple)]/5"
                                >
                                    <TableCell>
                                        <GuestCell guestName={f.guestName} unitName={f.unitName} />
                                    </TableCell>
                                    <TableCell
                                        colSpan={COST_CATEGORIES.length + 1}
                                        className="text-right text-xs font-semibold text-amber-700"
                                    >
                                        Consumo no disponible
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filtered.map((c) => (
                                <TableRow
                                    key={c.reservationId}
                                    className="hover:bg-[var(--color-brand-purple)]/[0.02] border-b-[var(--color-brand-purple)]/5"
                                >
                                    <TableCell>
                                        <GuestCell guestName={c.guestName} unitName={c.unitName} />
                                    </TableCell>
                                    {c.lineItems.map((item) => (
                                        <TableCell
                                            key={item.category}
                                            className={`text-right text-sm tabular-nums ${
                                                item.consumed
                                                    ? "font-semibold text-slate-700"
                                                    : "text-slate-300"
                                            }`}
                                        >
                                            {/* Tres estados, no dos: facturó (monto), corrió gratis
                                                ("Sin cargo": la firma nativa) o no corrió ("—").
                                                El "—" para una firma ejecutada se leía como plata
                                                perdida. */}
                                            {item.consumed
                                                ? formatUsd(item.amount)
                                                : item.freeCount > 0
                                                    ? <span className="text-xs font-medium text-slate-400">Sin cargo</span>
                                                    : "—"}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-extrabold text-[var(--color-brand-navy)] tabular-nums">
                                        {formatUsd(c.total)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>
        </SectionCard>
    )
}

function GuestCell({ guestName, unitName }: { guestName: string; unitName: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)] flex items-center justify-center text-xs font-bold">
                {initials(guestName)}
            </div>
            <div className="min-w-0">
                <p className="font-bold text-[var(--color-brand-navy)] truncate">
                    {guestName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                    {unitName}
                </p>
            </div>
        </div>
    )
}
