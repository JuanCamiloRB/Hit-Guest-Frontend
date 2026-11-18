"use client"

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
    ColumnFiltersState,
    OnChangeFn,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Surface } from "@/components/ui/card"
import { SMALL_SCREEN_QUERY, useMediaQuery } from "@/hooks/useMediaQuery"

/** Lo que cuenta el pie («Mostrando 1–10 de 28 alojamientos»). */
export interface DataTableItemLabel {
    singular: string
    plural: string
}

/**
 * Un clic dentro de un control no es un clic en la fila: enlaces, botones,
 * campos, los roles de control de Radix y cualquier zona marcada con
 * `data-row-interactive` (para un control que no entre en esta lista).
 */
const INTERACTIVE_SELECTOR = [
    "a", "button", "input", "select", "textarea", "label", "[contenteditable]",
    "[role=button]", "[role=link]", "[role=menuitem]", "[role=checkbox]", "[role=switch]",
    "[role=radio]", "[role=combobox]", "[role=tab]", "[role=option]", "[data-row-interactive]",
].join(", ")
function isInteractive(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

/**
 * El clic en el resto de la fila se reenvía al enlace REAL de la fila (el
 * `TextLink` de la celda): misma navegación de `next/link`, sin router propio.
 * Sin enlace dentro, navega a `href` tal cual.
 */
function followRow(event: React.MouseEvent<HTMLElement>, href: string) {
    if (isInteractive(event.target)) return
    const link = event.currentTarget.querySelector<HTMLAnchorElement>("a[href]")
    if (link) link.click()
    else window.location.assign(href)
}

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    filterColumn?: string
    /**
     * Orden inicial. Sin esto la tabla muestra las filas en el orden en que
     * llegan del backend — un criterio invisible para quien la mira.
     */
    defaultSorting?: SortingState
    /**
     * Orden controlado desde afuera (patrón estándar de TanStack): para quien
     * necesita decidir ANTES de ordenar (p. ej. completar los datos de una
     * columna). Sin estas dos props la tabla maneja su propio orden.
     */
    sorting?: SortingState
    onSortingChange?: OnChangeFn<SortingState>
    /**
     * Avisa qué filas están en pantalla y cuáles forman la página siguiente
     * (página, orden y filtro aplicados), cada vez que cambian. Para cargar
     * por fila solo lo que se ve y precargar lo próximo. Debe ser una función
     * estable (useCallback): cada identidad nueva vuelve a avisar.
     */
    onVisibleRowsChange?: (visible: TData[], next: TData[]) => void
    /**
     * Identidad estable de cada fila. Sin esto la fila se identifica por su
     * posición, y reemplazar la lista por otra del mismo tamaño no cuenta como
     * un cambio de filas visibles.
     */
    getRowId?: (row: TData) => string
    /**
     * Lo que se muestra sin filas: normalmente un `EmptyState` (`empty` o
     * `no-results`). Sin él, «No hay resultados.» como siempre.
     */
    empty?: React.ReactNode
    /** Filas por página. 10 por omisión. */
    pageSize?: number
    /**
     * Qué se cuenta en el pie: con esto dice «Mostrando 1–10 de 28 alojamientos»
     * (y «Página 1 de 3» como dato secundario); sin esto, solo la página.
     */
    itemLabel?: DataTableItemLabel
    /**
     * A dónde lleva la fila entera. El enlace REAL (teclado, lector) va en una
     * celda (`TextLink`); esto solo hace pulsable el resto de la fila, sin
     * robarle el clic a un control que haya dentro.
     */
    getRowHref?: (row: TData) => string
    /**
     * Cómo se ve una fila por debajo de `md`: en vez de seis columnas con
     * scroll, una fila apilada (nombre, estado, metadatos). Misma página, orden
     * y filtro que la tabla. Sin esto, la tabla con scroll horizontal.
     */
    renderMobileRow?: (row: TData) => React.ReactNode
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filterColumn,
    defaultSorting,
    sorting: controlledSorting,
    onSortingChange,
    onVisibleRowsChange,
    getRowId,
    empty,
    pageSize: pageSizeOption = 10,
    itemLabel,
    getRowHref,
    renderMobileRow,
}: DataTableProps<TData, TValue>) {
    const stacked = useMediaQuery(SMALL_SCREEN_QUERY) && renderMobileRow !== undefined
    const [ownSorting, setOwnSorting] = React.useState<SortingState>(defaultSorting ?? [])
    const sorting = controlledSorting ?? ownSorting
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns,
        getRowId,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: onSortingChange ?? setOwnSorting,
        // TanStack vuelve a la página 1 cada vez que `data` cambia de identidad,
        // y las filas se completan de a poco (semáforos): pasar a la página 2
        // devolvía a la 1 en cuanto llegaban sus datos. La página se reinicia
        // solo cuando cambia lo que se ve (efecto de abajo).
        autoResetPageIndex: false,
        initialState: { pagination: { pageSize: pageSizeOption } },
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

    // Volver a la primera página solo si cambian las filas (búsqueda, filtro,
    // altas y bajas), el orden o un filtro de columna; no cuando llegan datos
    // nuevos para las mismas filas.
    const rowsKey = getRowId ? data.map(getRowId).join("|") : String(data.length)
    const sortingKey = sorting.map((s) => `${s.id}:${s.desc}`).join(",")
    const filtersKey = JSON.stringify(columnFilters)
    React.useEffect(() => {
        table.setPageIndex(0)
    }, [table, rowsKey, sortingKey, filtersKey])

    // La página siguiente, con el mismo orden y filtro que la actual.
    const { pageIndex, pageSize } = table.getState().pagination
    const total = table.getPrePaginationRowModel().rows.length
    const nextRows = table.getPrePaginationRowModel().rows.slice((pageIndex + 1) * pageSize, (pageIndex + 2) * pageSize)
    // La clave resume las filas visibles y las siguientes: con los mismos
    // conjuntos no se vuelve a avisar aunque `data` cambie de identidad (p. ej.
    // al completarse una fila).
    const visibleKey = [...table.getRowModel().rows, ...nextRows].map((row) => row.id).join("|")
    React.useEffect(() => {
        onVisibleRowsChange?.(
            table.getRowModel().rows.map((row) => row.original),
            nextRows.map((row) => row.original),
        )
        // `nextRows` se deriva de la tabla en cada render; `visibleKey` lo resume.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, visibleKey, onVisibleRowsChange])

    return (
        <div className="w-full">
            {filterColumn && (
                <div className="flex items-center py-4 px-1">
                    <Input
                        placeholder={`Filtrar por ${filterColumn}...`}
                        value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm h-9"
                    />
                </div>
            )}
            {stacked ? (
                <Surface flat className="overflow-hidden">
                    {table.getRowModel().rows.length ? (
                        <ul className="divide-y divide-rule">
                            {table.getRowModel().rows.map((row) => {
                                const href = getRowHref?.(row.original)
                                return (
                                    <li
                                        key={row.id}
                                        data-slot="data-table-mobile-row"
                                        className={cn("px-4 py-3", href && "cursor-pointer transition-colors hover:bg-primary/5")}
                                        onClick={href ? (event) => followRow(event, href) : undefined}
                                    >
                                        {renderMobileRow!(row.original)}
                                    </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <div className="whitespace-normal">{empty ?? <p className="p-6 text-center text-sm text-ink-3">No hay resultados.</p>}</div>
                    )}
                </Surface>
            ) : (
            <Surface flat className="overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        if (header.isPlaceholder) {
                                            return <TableHead key={header.id} className="whitespace-nowrap" />
                                        }

                                        const content = flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )

                                        if (!header.column.getCanSort()) {
                                            return (
                                                <TableHead key={header.id} className="whitespace-nowrap">
                                                    {content}
                                                </TableHead>
                                            )
                                        }

                                        const sorted = header.column.getIsSorted()

                                        return (
                                            <TableHead
                                                key={header.id}
                                                className="whitespace-nowrap"
                                                // Comunica el orden vigente a un lector de
                                                // pantalla, que no ve la flecha.
                                                aria-sort={
                                                    sorted === "asc"
                                                        ? "ascending"
                                                        : sorted === "desc"
                                                            ? "descending"
                                                            : "none"
                                                }
                                            >
                                                <UnstyledButton
                                                    type="button"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    title={
                                                        sorted === "asc"
                                                            ? "Ordenado de menor a mayor. Clic para invertir."
                                                            : sorted === "desc"
                                                                ? "Ordenado de mayor a menor. Clic para quitar el orden."
                                                                : "Clic para ordenar por esta columna."
                                                    }
                                                    className={cn(
                                                        "group -mx-1 inline-flex items-center gap-1.5 rounded-xs px-1 py-0.5 transition-colors",
                                                        "hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                                        sorted && "text-primary",
                                                    )}
                                                >
                                                    {content}
                                                    {/* El icono está SIEMPRE presente, en gris
                                                        tenue mientras la columna no ordena: si
                                                        solo apareciera al ordenar, nada indicaría
                                                        que el encabezado se puede pulsar. */}
                                                    {sorted === "asc" ? (
                                                        <Icon icon={ArrowUp} size="sm" />
                                                    ) : sorted === "desc" ? (
                                                        <Icon icon={ArrowDown} size="sm" />
                                                    ) : (
                                                        <Icon icon={ChevronsUpDown} size="sm"
                                                            className="text-ink-4 opacity-50 transition-opacity group-hover:opacity-100" />
                                                    )}
                                                </UnstyledButton>
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const href = getRowHref?.(row.original)
                                    return (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={href ? "cursor-pointer" : undefined}
                                        onClick={href ? (event) => followRow(event, href) : undefined}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="whitespace-nowrap">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    {/* `empty` deja que la pantalla distinga «sin datos» de «sin
                                        resultados» (EmptyState); sin él, el texto de siempre. */}
                                    <TableCell colSpan={columns.length} className={empty ? "p-0 whitespace-normal" : "h-24 text-center"}>
                                        {empty ?? "No hay resultados."}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Surface>
            )}
            {/* Con una sola página (o ninguna fila) no hay nada que paginar: antes
                decía «Página 1 de 0». Mismo criterio que el detalle del Tablero. */}
            {table.getPageCount() > 1 && (
            // En móvil el pie se apila: rango y página en líneas propias, botones debajo.
            <div data-slot="data-table-footer" className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5 text-sm text-ink-3 sm:flex-row sm:items-center sm:gap-3">
                    {itemLabel ? (
                        <>
                            <span className="text-ink-2">Mostrando {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} de {total} {total === 1 ? itemLabel.singular : itemLabel.plural}</span>
                            <span>Página {pageIndex + 1} de {table.getPageCount()}</span>
                        </>
                    ) : (
                        <span>Página {pageIndex + 1} de {table.getPageCount()}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <Icon icon={ChevronLeft} className="mr-1" />
                        Anterior
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Siguiente
                        <Icon icon={ChevronRight} className="ml-1" />
                    </Button>
                </div>
            </div>
            )}
        </div>
    )
}
