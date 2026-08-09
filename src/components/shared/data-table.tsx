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

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    filterColumn?: string
    /**
     * Orden inicial. Sin esto la tabla muestra las filas en el orden en que
     * llegan del backend — un criterio invisible para quien la mira.
     */
    defaultSorting?: SortingState
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filterColumn,
    defaultSorting,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>(defaultSorting ?? [])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

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
            <div className="rounded-md border bg-card overflow-hidden">
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
                                                <button
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
                                                        "group -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors",
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
                                                        <ArrowUp size={13} aria-hidden className="shrink-0" />
                                                    ) : sorted === "desc" ? (
                                                        <ArrowDown size={13} aria-hidden className="shrink-0" />
                                                    ) : (
                                                        <ChevronsUpDown
                                                            size={13}
                                                            aria-hidden
                                                            className="shrink-0 text-ink-4 opacity-60 transition-opacity group-hover:opacity-100"
                                                        />
                                                    )}
                                                </button>
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="whitespace-nowrap">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No hay resultados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
