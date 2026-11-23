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
    type Column,
    type RowData,
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

declare module "@tanstack/react-table" {
    // Los genéricos tienen que coincidir con la declaración de TanStack.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        /** Solo layout del encabezado (alineación). */
        headerClassName?: string
        /** Solo layout de cada celda de la columna (alineación, ancho). */
        cellClassName?: string
        /** Columna fija a la izquierda al desplazar la tabla de lado (el huésped). */
        sticky?: "left"
        /**
         * Encabezado teñido de morado: `accent` para la columna de identidad,
         * `soft` para la cifra que importa (el precio). Texto en primary-hover.
         */
        headerTone?: "accent" | "soft"
        /**
         * Celdas unidas en una fila (una leyenda en lugar de siete guiones):
         * cuántas columnas ocupa esta celda; `0` = la cubre una anterior y no se
         * pinta. Sin esto, 1.
         */
        span?: (row: TData) => number
    }
}

/**
 * La columna fija necesita fondo opaco (si no, lo que pasa por debajo se ve) y
 * el MISMO hover que la fila: `TableRow` pinta `primary/5` translúcido sobre la
 * fila, así que aquí una capa detrás del contenido lo repite sobre `card`.
 */
// El borde derecho avisa que lo de al lado pasa por debajo al desplazar.
const STICKY_HEAD = "sticky left-0 z-20 border-r border-rule bg-table-head"
const STICKY_CELL = [
    "sticky left-0 z-10 border-r border-rule bg-card",
    "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-primary/5 before:opacity-0 before:transition-opacity",
    "group-hover/row:before:opacity-100 group-data-[state=selected]/row:before:opacity-100",
].join(" ")

const HEADER_TONE: Record<"accent" | "soft", string> = {
    accent: "bg-table-head-accent text-primary-hover",
    soft: "bg-table-head-soft text-primary-hover",
}

/**
 * Densidad de la tabla. `compact` (por omisión) es la de Operaciones: muchas
 * columnas en 1280 px. `comfortable` es la de un listado de pocas columnas
 * (Alojamientos): encabezado de 44 px, filas de 56 px y 16 px a los lados
 * desde 1024 px de tabla (`@5xl`); por debajo, 12 px, para que a 1280 px de
 * ventana (959 px de tabla) no aparezca el desplazamiento lateral.
 */
export type DataTableDensity = "compact" | "comfortable"
const DENSITY: Record<DataTableDensity, { head: string; cell: string }> = {
    compact: { head: "", cell: "" },
    comfortable: { head: "h-11 px-3 @5xl:px-4", cell: "h-14 px-3 py-2 @5xl:px-4" },
}

function headClasses<TData>(column: Column<TData, unknown>, density: DataTableDensity): string {
    const meta = column.columnDef.meta
    return cn("whitespace-nowrap", DENSITY[density].head, meta?.sticky === "left" && STICKY_HEAD, meta?.headerTone && HEADER_TONE[meta.headerTone], meta?.headerClassName)
}

function cellClasses<TData>(column: Column<TData, unknown>, density: DataTableDensity): string {
    const meta = column.columnDef.meta
    return cn("whitespace-nowrap", DENSITY[density].cell, meta?.sticky === "left" && STICKY_CELL, meta?.cellClassName)
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
    // Soltar el ratón tras seleccionar texto de la fila también llega como `click`.
    if (window.getSelection()?.toString()) return
    const { metaKey, ctrlKey, shiftKey, altKey } = event
    const link = event.currentTarget.querySelector<HTMLAnchorElement>("a[href]")
    if (link) {
        // Con los modificadores del clic original: `link.click()` los perdía y
        // Cmd/Ctrl+clic en la fila abría en la MISMA pestaña (next/link solo cede
        // al navegador cuando el evento viene modificado).
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey, ctrlKey, shiftKey, altKey }))
        return
    }
    if (metaKey || ctrlKey) window.open(href, "_blank", "noopener")
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
    /**
     * Paginación del SERVIDOR (Historial de transacciones, Clientes): `data` es
     * solo la página actual y el pie dice lo que el servidor contó. Sin orden
     * por columna: ordenar una página suelta parecería ordenar toda la lista.
     */
    serverPagination?: ServerPagination
    /**
     * Una fila que es un aviso («Consumo no disponible»): el color ES el
     * mensaje, por eso es la única que no lleva el hover de siempre.
     */
    getRowTone?: (row: TData) => "warning" | undefined
    /** La fila abierta en un panel lateral (Clientes → usuarios). */
    isRowSelected?: (row: TData) => boolean
    /** Los textos del pie en otro idioma (Facturación usa el diccionario); por omisión, español. */
    footerText?: Partial<DataTableFooterText>
    /**
     * Lo que define «otra búsqueda» en la pantalla (texto y filtros, en un
     * string o un valor estable): al cambiar, vuelve a la página 1. Con esto,
     * que lleguen, se editen o se borren filas no mueve la página que se lee.
     */
    resetPageOn?: unknown
    /** `comfortable` para un listado de pocas columnas (Alojamientos); por omisión, `compact`. */
    density?: DataTableDensity
}

/** Los textos del pie de paginación. */
export interface DataTableFooterText {
    range: (from: number, to: number, total: number, items: string) => string
    page: (page: number, last: number) => string
    previous: string
    next: string
}

const FOOTER_TEXT: DataTableFooterText = {
    range: (from, to, total, items) => `Mostrando ${from}–${to} de ${total} ${items}`,
    page: (page, last) => `Página ${page} de ${last}`,
    previous: "Anterior",
    next: "Siguiente",
}

/** Lo que el servidor dice de la página que mandó. */
export interface ServerPagination {
    /** Página actual, desde 0. */
    pageIndex: number
    pageCount: number
    /** Total de filas que contó el servidor; `null` si no lo dice (el pie dice solo la página). */
    total: number | null
    onPageChange: (pageIndex: number) => void
    /** El rango que dice el servidor («from»/«to»); sin él se calcula con `pageSize`. */
    range?: { from: number; to: number }
    /** Mientras llega otra página: los botones no se pueden pulsar dos veces. */
    loading?: boolean
}

const ROW_TONE: Record<"warning", string> = {
    warning: "bg-warning-sunk/30 hover:bg-warning-sunk/50",
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
    serverPagination,
    getRowTone,
    isRowSelected,
    footerText,
    resetPageOn,
    density = "compact",
}: DataTableProps<TData, TValue>) {
    const text = { ...FOOTER_TEXT, ...footerText }
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
        ...(serverPagination ? {
            manualPagination: true,
            pageCount: serverPagination.pageCount,
            enableSorting: false,
            onPaginationChange: (updater) => {
                const current = { pageIndex: serverPagination.pageIndex, pageSize: pageSizeOption }
                const next = typeof updater === "function" ? updater(current) : updater
                if (next.pageIndex !== serverPagination.pageIndex) serverPagination.onPageChange(next.pageIndex)
            },
        } : {}),
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            ...(serverPagination ? { pagination: { pageIndex: serverPagination.pageIndex, pageSize: pageSizeOption } } : {}),
        },
    })

    const rowsKey = getRowId ? data.map(getRowId).join("|") : String(data.length)
    const sortingKey = sorting.map((s) => `${s.id}:${s.desc}`).join(",")
    const filtersKey = JSON.stringify(columnFilters)
    // Cuándo se vuelve a la página 1. Con paginación de servidor, nunca: cada
    // página TRAE filas nuevas y reiniciar pediría la primera en cuanto llegara
    // la segunda.
    //  - Si la pantalla dice qué es «otra búsqueda» (`resetPageOn`: su texto y
    //    sus filtros), se reinicia cuando eso cambia o cambia el orden; las
    //    filas que llegan, se editan o se borran NO mueven la página.
    //  - Sin eso, se reinicia cuando desaparece alguna fila que se veía en la
    //    lista (una búsqueda que la recorta) o cambia el orden. Filas que solo
    //    se agregan (carga progresiva, en cualquier posición) no la mueven.
    // En los dos casos, si la página quedó más allá de la última, va a la última.
    const serverPaged = serverPagination !== undefined
    const rowIds = getRowId ? data.map(getRowId) : null
    const lastSeen = React.useRef({ ids: rowIds, sortingKey, filtersKey, resetPageOn })
    React.useEffect(() => {
        const last = lastSeen.current
        lastSeen.current = { ids: rowIds, sortingKey, filtersKey, resetPageOn }
        if (serverPaged) return
        const orderChanged = last.sortingKey !== sortingKey || last.filtersKey !== filtersKey
        const screenReset = resetPageOn !== undefined
            ? !Object.is(last.resetPageOn, resetPageOn)
            : rowIds === null || last.ids === null
                ? last.ids?.length !== rowIds?.length
                : (() => { const now = new Set(rowIds); return last.ids.some((id) => !now.has(id)) })()
        if (orderChanged || screenReset) {
            table.setPageIndex(0)
            return
        }
        const lastPage = Math.max(0, table.getPageCount() - 1)
        if (table.getState().pagination.pageIndex > lastPage) table.setPageIndex(lastPage)
        // `rowIds` se rehace en cada render; `rowsKey` lo resume.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table, rowsKey, sortingKey, filtersKey, serverPaged, resetPageOn])

    // La página siguiente, con el mismo orden y filtro que la actual.
    const { pageIndex, pageSize } = table.getState().pagination
    const total = serverPagination ? serverPagination.total : table.getPrePaginationRowModel().rows.length
    const pageRowCount = table.getRowModel().rows.length
    const busy = serverPagination?.loading === true
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
        // Contenedor de consulta: la densidad cómoda mide el ANCHO DE LA TABLA,
        // no el de la ventana (el sidebar contraído o abierto lo cambia).
        <div className="@container w-full">
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
                                const tone = getRowTone?.(row.original)
                                return (
                                    <li
                                        key={row.id}
                                        data-slot="data-table-mobile-row"
                                        data-state={isRowSelected?.(row.original) ? "selected" : undefined}
                                        className={cn("px-4 py-3", href && "cursor-pointer transition-colors hover:bg-primary/5", tone && ROW_TONE[tone])}
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
            // Cómoda, la tabla es la tarjeta de la vista: lleva la sombra de una tarjeta.
            <Surface flat={density === "compact"} className="overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        // Con columnas agrupadas («Automatizaciones», «Reportes») el
                                        // grupo ocupa las columnas que agrupa; sin `colSpan` el
                                        // encabezado quedaba corrido respecto de sus celdas.
                                        if (header.isPlaceholder) {
                                            return <TableHead key={header.id} colSpan={header.colSpan} className={headClasses(header.column, density)} />
                                        }

                                        const content = flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )

                                        if (!header.column.getCanSort()) {
                                            return (
                                                <TableHead key={header.id} colSpan={header.colSpan} className={headClasses(header.column, density)}>
                                                    {content}
                                                </TableHead>
                                            )
                                        }

                                        const sorted = header.column.getIsSorted()

                                        return (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                                className={headClasses(header.column, density)}
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
                                                        "hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                                        sorted && "text-primary-hover",
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
                                                            className="text-ink-4 transition-colors group-hover:text-primary-hover" />
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
                                    const tone = getRowTone?.(row.original)
                                    const selected = row.getIsSelected() || isRowSelected?.(row.original) === true
                                    return (
                                    <TableRow
                                        key={row.id}
                                        data-state={selected ? "selected" : undefined}
                                        className={cn(href && "cursor-pointer", tone && ROW_TONE[tone])}
                                        onClick={href ? (event) => followRow(event, href) : undefined}
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            const span = cell.column.columnDef.meta?.span?.(row.original) ?? 1
                                            if (span === 0) return null
                                            return (
                                                <TableCell key={cell.id} colSpan={span > 1 ? span : undefined} className={cellClasses(cell.column, density)}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    {/* `empty` deja que la pantalla distinga «sin datos» de «sin
                                        resultados» (EmptyState); sin él, el texto de siempre. */}
                                    <TableCell colSpan={table.getVisibleLeafColumns().length} className={empty ? "p-0 whitespace-normal" : "h-24 text-center"}>
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
                    {itemLabel && total !== null ? (
                        <>
                            <span className="text-ink-2">{text.range(
                                serverPagination?.range?.from ?? pageIndex * pageSize + 1,
                                serverPagination?.range?.to ?? pageIndex * pageSize + pageRowCount,
                                total,
                                total === 1 ? itemLabel.singular : itemLabel.plural,
                            )}</span>
                            <span>{text.page(pageIndex + 1, table.getPageCount())}</span>
                        </>
                    ) : (
                        <span>{text.page(pageIndex + 1, table.getPageCount())}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* `type="button"`: la tabla puede vivir dentro de un formulario
                        (los alojamientos en el editor de la propiedad) y paginar
                        no puede enviarlo. */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage() || busy}
                    >
                        <Icon icon={ChevronLeft} className="mr-1" />
                        {text.previous}
                    </Button>
                    {/* El paso hacia adelante va resaltado; «Anterior», neutro. */}
                    <Button
                        type="button"
                        variant="outline-accent"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage() || busy}
                    >
                        {text.next}
                        <Icon icon={ChevronRight} className="ml-1" />
                    </Button>
                </div>
            </div>
            )}
        </div>
    )
}
