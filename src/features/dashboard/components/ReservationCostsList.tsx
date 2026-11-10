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
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
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

/** Filas por página: la tarjeta mide siempre lo mismo, como la tabla de Operaciones. */
export const PAGE_SIZE = 15

/**
 * Solo el desglose tiene `lineItems`; así se distingue en la lista paginada.
 * (Al revés no narra: un `ReservationCost` también cumple la forma de un fallo.)
 */
function isCost(row: ReservationCost | ReservationCostFailure): row is ReservationCost {
    return "lineItems" in row
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
export function ReservationCostsList({
    costs,
    failedReservations = [],
    isLoading,
    unavailable = false,
    loadingProgress = null,
}: Props) {
    const [query, setQuery] = useState("")
    // Una búsqueda nueva vuelve a la primera página.
    const [page, setPage] = useState(1)
    const search = (value: string) => {
        setQuery(value)
        setPage(1)
    }

    // Las fallidas van primero (son lo que hay que mirar) y entran en la misma
    // paginación: la tarjeta mide siempre PAGE_SIZE filas.
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase()
        const failed = q ? failedReservations.filter((f) => matches(f, q)) : failedReservations
        const filtered = q ? costs.filter((c) => matches(c, q)) : costs
        return [...failed, ...filtered]
    }, [costs, failedReservations, query])
    // Si la lista se achica (búsqueda) la página actual se recorta sola; si
    // crece (carga progresiva) aparecen páginas nuevas sin mover la actual.
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const current = Math.min(page, pageCount)
    const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

    return (
        <SectionCard
            // Hermana de las otras secciones del Tablero, que son h2.
            headingLevel={2}
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
                        ) : rows.length === 0 ? (
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
                            pageRows.map((row) => !isCost(row) ? (
                                <TableRow
                                    key={row.reservationId}
                                    className="bg-warning-sunk/40 hover:bg-warning-sunk/60"
                                >
                                    <TableCell>
                                        <GuestCell guestName={row.guestName} unitName={row.unitName} />
                                    </TableCell>
                                    <TableCell
                                        colSpan={COST_CATEGORIES.length + 1}
                                        className="text-right text-xs font-semibold text-warning"
                                    >
                                        Consumo no disponible
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <TableRow
                                    key={row.reservationId}
                                    className="hover:bg-sunk/50"
                                >
                                    <TableCell>
                                        <GuestCell guestName={row.guestName} unitName={row.unitName} />
                                    </TableCell>
                                    {row.lineItems.map((item) => (
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
                                        {formatUsd(row.total)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {(isLoading && loadingProgress) || pageCount > 1 ? (
                // El mismo control que la tabla de Operaciones (DataTable).
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-3 sm:px-6">
                    <div className="text-sm text-muted-foreground">
                        {pageCount > 1 ? `Página ${current} de ${pageCount}` : null}
                        {isLoading && loadingProgress && (
                            <span role="status" className={pageCount > 1 ? "ml-3" : ""}>
                                Cargando el consumo · {loadingProgress.done} de {loadingProgress.total} reservas
                            </span>
                        )}
                    </div>
                    {pageCount > 1 && (
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current <= 1}>
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Anterior
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pageCount}>
                                Siguiente
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
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
