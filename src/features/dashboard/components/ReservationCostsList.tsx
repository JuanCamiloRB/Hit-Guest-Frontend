"use client"

import { useMemo, useState } from "react"
import { format, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import { SectionCard } from "@/components/ui/section-card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { type LucideIcon } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { SearchField } from "@/components/ui/search-field"
import { COST_CATEGORIES } from "@/features/billing/lib/pricing"
import { formatUsd, type CostCategory, type ReservationCost, type ReservationCostFailure } from "@/features/billing/types"
import { cn } from "@/lib/utils"
import { ColumnHeader, IdentityCell } from "@/components/shared/table-cells"
import { AUTOMATION_ICONS } from "@/components/shared/automation-icons"
import { DeliveryChannelIcon } from "@/components/brand/DeliveryChannelIcon"

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
type CostRowData = ReservationCost | ReservationCostFailure

/** Lo que dice la celda de una categoría: monto, «Sin cargo» (corrió gratis) o «—» (no corrió). */
function CategoryCell({ row, category }: { row: CostRowData; category: string }) {
    if (!isCost(row)) {
        return <span className="text-xs font-semibold text-warning">Consumo no disponible</span>
    }
    // Ningún nodo corrió: una leyenda en lugar de siete guiones (la celda ocupa las siete).
    if (!ranAny(row)) return <span className="text-xs text-ink-3">Sin ejecuciones facturables</span>
    const item = row.lineItems.find((line) => line.category === category)
    // Tres estados, no dos: facturó (monto), corrió gratis ("Sin cargo": la
    // firma nativa) o no corrió ("—"). El "—" para una firma ejecutada se leía
    // como plata perdida.
    if (item?.consumed) return <span className="text-sm font-medium tabular-nums text-ink">{formatUsd(item.amount)}</span>
    if (item && item.freeCount > 0) return <StatusPill tone="success">Sin cargo</StatusPill>
    return (
        <span className="text-sm text-ink-4">
            <span aria-hidden>—</span>
            <span className="sr-only">No se ejecutó</span>
        </span>
    )
}

/**
 * El encabezado de cada categoría con el MISMO ícono que su columna en
 * Operaciones (`AUTOMATION_ICONS`); WhatsApp y la OTA, con la marca del canal
 * por el que sale el link.
 */
function CategoryHeader({ category, label }: { category: CostCategory; label: string }) {
    const mark = category === "whatsapp" ? <DeliveryChannelIcon channel="whatsapp" />
        : category === "otaInbox" ? <DeliveryChannelIcon channel="ota" />
            : undefined
    return <ColumnHeader icon={mark ? undefined : CATEGORY_ICONS[category]} mark={mark} label={label} align="end" />
}

const CATEGORY_ICONS: Partial<Record<CostCategory, LucideIcon>> = {
    checkin: AUTOMATION_ICONS.identity,
    contract: AUTOMATION_ICONS.contract,
    tra: AUTOMATION_ICONS.tra,
    sire: AUTOMATION_ICONS.sire,
    access: AUTOMATION_ICONS.access,
}

const FIRST_CATEGORY = COST_CATEGORIES[0]?.key

/**
 * Las columnas: huésped (fijo a la izquierda), una por categoría facturable y
 * el total. La fila de un fallo y la de «sin ejecuciones» unen sus celdas
 * (`meta.span`): una leyenda, no una fila de guiones ni un 0 USD.
 */
const COST_COLUMNS: ColumnDef<CostRowData>[] = [
    {
        id: "guest",
        accessorFn: (row) => row.guestName,
        sortingFn: (a, b) => a.original.guestName.localeCompare(b.original.guestName, "es", { sensitivity: "base" }),
        header: "Huésped / Alojamiento",
        meta: { sticky: "left" },
        cell: ({ row }) => <GuestCell row={row.original} muted={isCost(row.original) && row.original.total <= 0} />,
    },
    ...COST_CATEGORIES.map((category): ColumnDef<CostRowData> => ({
        id: category.key,
        accessorFn: (row) => (isCost(row) ? row.lineItems.find((line) => line.category === category.key)?.amount ?? 0 : undefined),
        // Un fallo no tiene monto: arriba en los dos sentidos (es lo que hay que mirar).
        sortUndefined: "first",
        header: () => <CategoryHeader category={category.key} label={category.label} />,
        meta: {
            align: "end",
            span: (row) => {
                const merged = !isCost(row) ? COST_CATEGORIES.length + 1 : !ranAny(row) ? COST_CATEGORIES.length : 1
                if (merged === 1) return 1
                return category.key === FIRST_CATEGORY ? merged : 0
            },
        },
        cell: ({ row }) => <CategoryCell row={row.original} category={category.key} />,
    })),
    {
        id: "total",
        accessorFn: (row) => (isCost(row) ? row.total : undefined),
        sortUndefined: "first",
        // La columna que responde «cuánto costó»: ancla visual de la tabla.
        header: () => <span className="font-bold">Total</span>,
        // La columna Total, apenas teñida del morado de interacción (3 %).
        meta: { align: "end", cellClassName: "bg-primary/[0.03]", span: (row) => (isCost(row) ? 1 : 0) },
        cell: ({ row }) => {
            const cost = row.original as ReservationCost
            // La que facturó destaca en navy y negrita; la de cero, apagada.
            return <span className={cn("tabular-nums", cost.total > 0 ? "font-bold text-brand-navy" : "text-ink-3")}>{formatUsd(cost.total)}</span>
        },
    },
]

const COSTS_LABEL = { singular: "reserva", plural: "reservas" }
const costRowId = (row: CostRowData) => row.reservationId
const costRowTone = (row: CostRowData) => (isCost(row) ? undefined : "warning" as const)

/**
 * La fila apilada de móvil: huésped y total arriba; debajo, cada categoría que
 * corrió con su ícono, su nombre y lo que costó (en la tabla, sus columnas).
 */
function CostMobileRow({ row }: { row: CostRowData }) {
    const ran = isCost(row) ? row.lineItems.filter((item) => item.consumed || item.freeCount > 0) : []
    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <GuestCell row={row} muted={isCost(row) && row.total <= 0} />
                {isCost(row)
                    ? <span className={cn("shrink-0 tabular-nums", row.total > 0 ? "font-bold text-brand-navy" : "text-ink-3")}>{formatUsd(row.total)}</span>
                    : <span className="shrink-0 text-xs font-semibold text-warning">Consumo no disponible</span>}
            </div>
            {isCost(row) && (ran.length > 0 ? (
                <ul className="space-y-1" aria-label="Desglose">
                    {COST_CATEGORIES.filter((c) => ran.some((item) => item.category === c.key)).map((category) => (
                        <li key={category.key} className="flex items-center justify-between gap-3 text-sm">
                            <span className="inline-flex items-center gap-1.5 text-ink-2">
                                {category.key === "whatsapp" ? <DeliveryChannelIcon channel="whatsapp" />
                                    : category.key === "otaInbox" ? <DeliveryChannelIcon channel="ota" />
                                        : CATEGORY_ICONS[category.key] && <Icon icon={CATEGORY_ICONS[category.key]!} size="sm" className="text-ink-3" />}
                                {category.label}
                            </span>
                            <CategoryCell row={row} category={category.key} />
                        </li>
                    ))}
                </ul>
            ) : <p className="text-xs text-ink-3">Sin ejecuciones facturables</p>)}
        </div>
    )
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
    // Cargado: las que facturaron, de mayor a menor (las fallidas arriba). Se
    // puede ordenar por cualquier columna, como toda tabla.
    const [sorting, setSorting] = useState<SortingState>([{ id: "total", desc: true }])
    const clearFilters = () => {
        setQuery("")
        setOnlyBilled(false)
    }
    // Mismo criterio que el resumen de arriba: consumo facturado = total > 0.
    const billedCount = useMemo(() => costs.filter((c) => c.total > 0).length, [costs])

    // Las fallidas van primero (son lo que hay que mirar) y entran en la misma
    // paginación. Durante la carga progresiva se respeta el orden de llegada
    // (sin orden aplicado): reordenar con cada lote haría saltar la primera página.
    const rows = useMemo<CostRowData[]>(() => {
        const q = query.trim().toLowerCase()
        const failed = (q ? failedReservations.filter((f) => matches(f, q)) : failedReservations)
            .filter(() => !onlyBilled)
        let filtered = q ? costs.filter((c) => matches(c, q)) : costs
        if (onlyBilled) filtered = filtered.filter((c) => c.total > 0)
        return [...failed, ...filtered]
    }, [costs, failedReservations, query, onlyBilled])

    return (
        <SectionCard
            // Hermana de las otras secciones del Tablero, que son h2.
            headingLevel={2}
            flush
            title="Detalle por reserva"
            flat
            description="Desglose de las reservas cargadas, con o sin consumo facturado."
            actions={
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {billedCount > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-pressed={onlyBilled}
                            onClick={() => setOnlyBilled((value) => !value)}
                        >
                            {/* Un solo texto: el nombre accesible queda «Solo con consumo (N)». */}
                            <span className="tabular-nums">Solo con consumo ({billedCount})</span>
                        </Button>
                    )}
                    <SearchField
                        size="sm"
                        placeholder="Buscar huésped, alojamiento…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        label="Buscar en el consumo por reserva"
                        className="w-full sm:w-64"
                    />
                </div>
            }
        >
            <div className="p-4">
                {isLoading && loadingProgress && (
                    <p role="status" className="mb-3 text-sm text-ink-3">
                        Cargando el consumo · {loadingProgress.done} de {loadingProgress.total} reservas
                    </p>
                )}
                {isLoading && costs.length === 0 ? (
                    <LoadingState rows={4} label="Cargando consumo por reserva" />
                ) : unavailable ? (
                    <EmptyState title="Consumo no disponible" />
                ) : (
                    <DataTable
                        columns={COST_COLUMNS}
                        data={rows}
                        getRowId={costRowId}
                        // Otra búsqueda vuelve a la página 1; las reservas que llegan
                        // durante la carga (en cualquier posición) no la mueven.
                        resetPageOn={`${query.trim()}|${onlyBilled}`}
                        getRowTone={costRowTone}
                        renderMobileRow={(row) => <CostMobileRow row={row} />}
                        pageSize={PAGE_SIZE}
                        itemLabel={COSTS_LABEL}
                        sorting={isLoading ? NO_SORTING : sorting}
                        onSortingChange={setSorting}
                        empty={query || onlyBilled ? (
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
                    />
                )}
            </div>
        </SectionCard>
    )
}

const NO_SORTING: SortingState = []

/** Huésped (enlace a su reserva) y, debajo, alojamiento y check-in. */
function GuestCell({ row, muted = false }: { row: ReservationCost | ReservationCostFailure; muted?: boolean }) {
    const checkIn = row.checkIn instanceof Date && isValid(row.checkIn)
        ? format(row.checkIn, "d MMM yyyy", { locale: es })
        : null
    return (
        <IdentityCell
            name={row.guestName}
            href={`/dashboard/reservations/${row.reservationId}`}
            linkProps={{ tone: muted ? "muted" : "ink" }}
            className="max-w-56"
            secondary={<>
                {row.unitName}
                {checkIn && <> · <span className="whitespace-nowrap">check-in {checkIn}</span></>}
            </>}
        />
    )
}
