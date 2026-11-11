"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
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
import { cn } from "@/lib/utils"

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

/** Algún nodo corrió en la reserva, con o sin cargo. */
function ranAny(row: ReservationCost): boolean {
    return row.lineItems.some((item) => item.consumed || item.freeCount > 0)
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
    const [onlyBilled, setOnlyBilled] = useState(false)
    // Una búsqueda o un filtro nuevo vuelve a la primera página.
    const [page, setPage] = useState(1)
    const search = (value: string) => {
        setQuery(value)
        setPage(1)
    }
    const toggleOnlyBilled = () => {
        setOnlyBilled((value) => !value)
        setPage(1)
    }
    const clearFilters = () => {
        setQuery("")
        setOnlyBilled(false)
        setPage(1)
    }
    // Mismo criterio que el resumen de arriba: consumo facturado = total > 0.
    const billedCount = useMemo(() => costs.filter((c) => c.total > 0).length, [costs])

    // Las fallidas van primero (son lo que hay que mirar) y entran en la misma
    // paginación: la tarjeta mide siempre PAGE_SIZE filas. Después, las que
    // facturaron, de mayor a menor: es lo que se viene a buscar. Durante la carga
    // progresiva se respeta el orden de llegada; reordenar con cada lote haría
    // saltar la primera página.
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase()
        const failed = (q ? failedReservations.filter((f) => matches(f, q)) : failedReservations)
            .filter(() => !onlyBilled)
        let filtered = q ? costs.filter((c) => matches(c, q)) : costs
        if (onlyBilled) filtered = filtered.filter((c) => c.total > 0)
        const ordered = isLoading ? filtered : [...filtered].sort((a, b) => b.total - a.total)
        return [...failed, ...ordered]
    }, [costs, failedReservations, query, onlyBilled, isLoading])
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
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {billedCount > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-pressed={onlyBilled}
                            onClick={toggleOnlyBilled}
                            className={cn(onlyBilled && "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary")}
                        >
                            {/* Un solo texto: el nombre accesible queda «Solo con consumo (N)». */}
                            <span className="tabular-nums">Solo con consumo ({billedCount})</span>
                        </Button>
                    )}
                    <div className="relative w-full sm:w-64">
                        <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                        <Input
                            placeholder="Buscar huésped, alojamiento…"
                            value={query}
                            onChange={(e) => search(e.target.value)}
                            className="pl-9 h-9"
                            aria-label="Buscar en el consumo por reserva"
                        />
                    </div>
                </div>
            }
        >
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {/* El estilo del encabezado lo pone la primitiva (navy sobre sunk). */}
                            <TableHead>
                                Huésped / Alojamiento
                            </TableHead>
                            {COST_CATEGORIES.map((c) => (
                                <TableHead
                                    key={c.key}
                                    className="text-right"
                                >
                                    {c.label}
                                </TableHead>
                            ))}
                            {/* La columna que responde «cuánto costó»: ancla visual de la tabla. */}
                            <TableHead className="text-right font-bold">
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
                                    {query || onlyBilled ? (
                                        <EmptyState
                                            kind="no-results"
                                            title="Ninguna reserva coincide con la búsqueda"
                                            description="Prueba con otro nombre de huésped o alojamiento."
                                            action={<Button variant="outline" size="sm" onClick={clearFilters}>Limpiar filtros</Button>}
                                        />
                                    ) : (
                                        <EmptyState
                                            title="Todavía no hay reservas para mostrar"
                                            description="Las reservas de la cuenta aparecerán aquí, con o sin consumo."
                                        />
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            pageRows.map((row) => !isCost(row) ? (
                                <TableRow
                                    key={row.reservationId}
                                    className="bg-warning-sunk/40 hover:bg-warning-sunk/60"
                                >
                                    <TableCell className="py-2.5">
                                        <GuestCell row={row} />
                                    </TableCell>
                                    <TableCell
                                        colSpan={COST_CATEGORIES.length + 1}
                                        className="text-right text-xs font-semibold text-warning"
                                    >
                                        Consumo no disponible
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <CostRow key={row.reservationId} row={row} />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {(isLoading && loadingProgress) || pageCount > 1 ? (
                // El mismo control que la tabla de Operaciones (DataTable).
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-3 sm:px-6">
                    <div className="text-sm text-ink-3">
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

/**
 * Una reserva con su desglose. La jerarquía responde «quién costó y cuánto»:
 * - facturó (total > 0): total en navy y en negrita (sin franja lateral: al
 *   repetirse en cada fila no señalaba nada y se leía como decoración);
 * - no corrió ningún nodo: una sola leyenda en vez de una fila de guiones;
 * - corrió gratis (firma nativa): «Sin cargo» como estado, no como dato muerto.
 */
function CostRow({ row }: { row: ReservationCost }) {
    const billed = row.total > 0
    return (
        <TableRow className="hover:bg-sunk/50">
            <TableCell className="py-2.5">
                <GuestCell row={row} muted={!billed} />
            </TableCell>
            {ranAny(row) ? row.lineItems.map((item) => (
                <TableCell
                    key={item.category}
                    className={cn("py-2.5 text-right text-sm tabular-nums", item.consumed ? "font-medium text-ink" : "text-ink-4")}
                >
                    {/* Tres estados, no dos: facturó (monto), corrió gratis
                        ("Sin cargo": la firma nativa) o no corrió ("—").
                        El "—" para una firma ejecutada se leía como plata
                        perdida. */}
                    {item.consumed ? (
                        formatUsd(item.amount)
                    ) : item.freeCount > 0 ? (
                        <StatusPill tone="success">Sin cargo</StatusPill>
                    ) : (
                        <>
                            <span aria-hidden>—</span>
                            <span className="sr-only">No se ejecutó</span>
                        </>
                    )}
                </TableCell>
            )) : (
                // Ningún nodo corrió: una leyenda en lugar de siete guiones.
                <TableCell colSpan={COST_CATEGORIES.length} className="py-2.5 text-right text-xs text-ink-3">
                    Sin ejecuciones facturables
                </TableCell>
            )}
            <TableCell
                className={cn(
                    // La columna Total, apenas teñida del morado de interacción (3 %).
                    "bg-primary/[0.03] py-2.5 text-right tabular-nums",
                    billed ? "font-bold text-brand-navy" : "text-ink-3",
                )}
            >
                {formatUsd(row.total)}
            </TableCell>
        </TableRow>
    )
}

/** Huésped (enlace a su reserva) y, debajo, alojamiento y check-in. */
function GuestCell({ row, muted = false }: { row: ReservationCost | ReservationCostFailure; muted?: boolean }) {
    const checkIn = row.checkIn instanceof Date && isValid(row.checkIn)
        ? format(row.checkIn, "d MMM yyyy", { locale: es })
        : null
    return (
        <div className="min-w-0">
            <Link
                href={`/dashboard/reservations/${row.reservationId}`}
                className={cn(
                    "block truncate rounded-xs font-medium transition-colors hover:text-primary hover:underline underline-offset-2",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    muted ? "text-ink-2" : "text-ink",
                )}
            >
                {row.guestName}
            </Link>
            <p className="truncate text-xs text-ink-3">
                {row.unitName}
                {checkIn && <> · <span className="whitespace-nowrap">check-in {checkIn}</span></>}
            </p>
        </div>
    )
}
