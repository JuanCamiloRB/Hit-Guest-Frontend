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
import { formatUsd, type ReservationCost } from "@/features/billing/types"

interface Props {
    costs: ReservationCost[]
    isLoading: boolean
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
 */
export function ReservationCostsList({ costs, isLoading }: Props) {
    const [query, setQuery] = useState("")

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return costs
        return costs.filter(
            (c) =>
                c.guestName.toLowerCase().includes(q) ||
                c.unitName.toLowerCase().includes(q) ||
                c.propertyName.toLowerCase().includes(q),
        )
    }, [costs, query])

    return (
        <SectionCard
            flush
            title="Consumo por reserva"
            description="Costo de cada automatización según lo consumido"
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
                        ) : filtered.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={COST_CATEGORIES.length + 2} className="p-0">
                                    <EmptyState
                                        title={
                                            query
                                                ? "Ninguna reserva coincide con la búsqueda"
                                                : "Todavía no hay reservas con consumo"
                                        }
                                        description={
                                            query
                                                ? "Prueba con otro nombre de huésped o alojamiento."
                                                : "Cuando una automatización se ejecute y facture, la reserva aparecerá aquí."
                                        }
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((c) => (
                                <TableRow
                                    key={c.reservationId}
                                    className="hover:bg-[var(--color-brand-purple)]/[0.02] border-b-[var(--color-brand-purple)]/5"
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)] flex items-center justify-center text-xs font-bold">
                                                {initials(c.guestName)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-[var(--color-brand-navy)] truncate">
                                                    {c.guestName}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {c.unitName}
                                                </p>
                                            </div>
                                        </div>
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </SectionCard>
    )
}
