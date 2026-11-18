import { act, fireEvent, render, screen, within } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ small: false }))
vi.mock("@/hooks/useMediaQuery", () => ({ SMALL_SCREEN_QUERY: "(max-width: 767px)", useMediaQuery: () => mocks.small }))
/** A qué enlace llegó el clic reenviado por la fila. */
const followed: string[] = []
const modifiers: { metaKey: boolean; ctrlKey: boolean }[] = []
// El enlace de la fila recibe un `click` real (con los modificadores del original):
// se registra y se cancela para que jsdom no intente navegar.
document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null
    if (!anchor) return
    followed.push(anchor.getAttribute("href") ?? "")
    modifiers.push({ metaKey: event.metaKey, ctrlKey: event.ctrlKey })
    event.preventDefault()
})

import { DataTable } from "./data-table"

interface Row { id: number; name: string }
const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Nombre", cell: ({ row }) => <a href={`/x/${row.original.id}`}>{row.original.name}</a> },
]
const rows: Row[] = Array.from({ length: 28 }, (_, i) => ({ id: i + 1, name: `Fila ${i + 1}` }))
const getRowId = (r: Row) => String(r.id)
const label = { singular: "alojamiento", plural: "alojamientos" }

describe("DataTable — tamaño de página, rango en el pie, fila enlazada y fila apilada", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.small = false
        followed.length = 0
        modifiers.length = 0
    })

    it("pageSize=10 e itemLabel: «Mostrando 1–10 de 28 alojamientos» y «Página 1 de 3»; la última página cierra el rango", async () => {
        render(<DataTable columns={columns} data={rows} getRowId={getRowId} pageSize={10} itemLabel={label} />)
        await act(async () => {})
        expect(screen.getAllByRole("row")).toHaveLength(11)
        expect(screen.getByText("Mostrando 1–10 de 28 alojamientos")).toBeInTheDocument()
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("Mostrando 21–28 de 28 alojamientos")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled()
    })

    it("pageSize manda: con 5, cinco filas y «Página 1 de 6»", async () => {
        render(<DataTable columns={columns} data={rows} getRowId={getRowId} pageSize={5} />)
        await act(async () => {})
        expect(screen.getAllByRole("row")).toHaveLength(6)
        expect(screen.getByText("Página 1 de 6")).toBeInTheDocument()
    })

    it("con una sola página no hay paginador", async () => {
        render(<DataTable columns={columns} data={rows.slice(0, 7)} getRowId={getRowId} pageSize={10} itemLabel={label} />)
        await act(async () => {})
        expect(screen.queryByText(/Mostrando/)).toBeNull()
        expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull()
    })

    it("getRowHref: pulsar la fila navega; pulsar el enlace de la celda no navega dos veces", async () => {
        render(<DataTable columns={columns} data={rows.slice(0, 3)} getRowId={getRowId} getRowHref={(r) => `/x/${r.id}`} />)
        await act(async () => {})
        const cell = screen.getByText("Fila 2").closest("td")!
        fireEvent.click(cell)
        expect(followed).toEqual(["/x/2"])
        // El clic directo en el enlace es del enlace (una entrada más): la fila no lo repite.
        fireEvent.click(screen.getByText("Fila 2"))
        expect(followed).toEqual(["/x/2", "/x/2"])
    })

    it("Cmd/Ctrl+clic en la fila llega al enlace CON el modificador (pestaña nueva); seleccionar texto no navega", async () => {
        render(<DataTable columns={columns} data={rows.slice(0, 3)} getRowId={getRowId} getRowHref={(r) => `/x/${r.id}`} />)
        await act(async () => {})
        const cell = screen.getByText("Fila 2").closest("td")!
        fireEvent.click(cell, { metaKey: true })
        expect(followed).toEqual(["/x/2"])
        expect(modifiers).toEqual([{ metaKey: true, ctrlKey: false }])
        // Soltar el ratón tras seleccionar texto también es un «click»: no es navegar.
        const selection = vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Fila" } as unknown as Selection)
        fireEvent.click(cell)
        expect(followed).toEqual(["/x/2"])
        selection.mockRestore()
    })

    it("un control dentro de la fila (role=button, data-row-interactive) no dispara la navegación de la fila", async () => {
        const cols: ColumnDef<Row>[] = [
            { accessorKey: "name", header: "Nombre", cell: ({ row }) => <a href={`/x/${row.original.id}`}>{row.original.name}</a> },
            { id: "acciones", header: "", cell: () => <><span role="button" tabIndex={0}>Menú</span><span data-row-interactive>Zona</span></> },
        ]
        render(<DataTable columns={cols} data={rows.slice(0, 2)} getRowId={getRowId} getRowHref={(r) => `/x/${r.id}`} />)
        await act(async () => {})
        fireEvent.click(screen.getAllByText("Menú")[0])
        fireEvent.click(screen.getAllByText("Zona")[0])
        expect(followed).toEqual([])
    })

    it("el pie se apila en móvil y va en fila desde sm", async () => {
        render(<DataTable columns={columns} data={rows} getRowId={getRowId} pageSize={10} itemLabel={label} />)
        await act(async () => {})
        const footer = document.querySelector('[data-slot="data-table-footer"]')!
        expect(footer.className).toContain("flex-col")
        expect(footer.className).toContain("sm:flex-row")
    })

    it("móvil con renderMobileRow: lista apilada con la misma paginación, y la fila entera navega", async () => {
        mocks.small = true
        render(
            <DataTable
                columns={columns}
                data={rows}
                getRowId={getRowId}
                pageSize={10}
                itemLabel={label}
                getRowHref={(r) => `/x/${r.id}`}
                renderMobileRow={(r) => <a href={`/x/${r.id}`} data-testid="stacked">{r.name}</a>}
            />,
        )
        await act(async () => {})
        expect(screen.queryByRole("table")).toBeNull()
        const list = screen.getByRole("list")
        expect(within(list).getAllByRole("listitem")).toHaveLength(10)
        expect(screen.getByText("Mostrando 1–10 de 28 alojamientos")).toBeInTheDocument()
        fireEvent.click(within(list).getAllByRole("listitem")[2])
        expect(followed).toEqual(["/x/3"])
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(within(list).getAllByTestId("stacked")[0]).toHaveTextContent("Fila 11")
    })

    it("móvil sin renderMobileRow: la tabla de siempre", async () => {
        mocks.small = true
        render(<DataTable columns={columns} data={rows.slice(0, 3)} getRowId={getRowId} />)
        await act(async () => {})
        expect(screen.getByRole("table")).toBeInTheDocument()
    })
})

describe("DataTable — encabezados agrupados y columna fija", () => {
    const grouped: ColumnDef<Row>[] = [
        { accessorKey: "name", header: "Nombre", meta: { sticky: "left" } },
        {
            id: "grupo",
            header: "Automatizaciones",
            meta: { headerClassName: "text-center" },
            columns: [
                { id: "a", header: "Link", cell: () => "✓", meta: { cellClassName: "text-center" } },
                { id: "b", header: "Contrato", cell: () => "✓" },
            ],
        },
    ]

    it("el grupo ocupa sus columnas (colSpan) y la fila vacía ocupa todas las columnas reales", async () => {
        const { rerender } = render(<DataTable columns={grouped} data={rows.slice(0, 2)} getRowId={getRowId} />)
        await act(async () => {})
        const group = screen.getByRole("columnheader", { name: "Automatizaciones" })
        expect(group).toHaveAttribute("colspan", "2")
        expect(group).toHaveClass("text-center")
        rerender(<DataTable columns={grouped} data={[]} getRowId={getRowId} />)
        expect(screen.getByRole("cell", { name: "No hay resultados." })).toHaveAttribute("colspan", "3")
    })

    it("meta.cellClassName llega a cada celda de la columna", async () => {
        render(<DataTable columns={grouped} data={rows.slice(0, 2)} getRowId={getRowId} />)
        await act(async () => {})
        const firstRow = screen.getAllByRole("row")[2]
        expect(within(firstRow).getAllByRole("cell")[1]).toHaveClass("text-center")
    })

    it("sticky: encabezado y celdas fijos a la izquierda con fondo opaco y el hover de la fila", async () => {
        render(<DataTable columns={grouped} data={rows.slice(0, 2)} getRowId={getRowId} />)
        await act(async () => {})
        expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveClass("sticky", "left-0", "bg-sunk")
        const cell = screen.getByRole("cell", { name: "Fila 1" })
        expect(cell).toHaveClass("sticky", "left-0", "bg-card", "group-hover/row:before:opacity-100")
        expect(cell.closest("tr")).toHaveClass("group/row")
    })
})
