import { fireEvent, render, screen } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"
import { DataTable } from "./data-table"

interface Row { id: number; name: string }

const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Nombre" }]
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Fila ${i + 1}` }))

describe("DataTable — sin filas", () => {
    it("sin `empty`, el texto de siempre", () => {
        render(<DataTable columns={columns} data={[]} />)
        expect(screen.getByText("No hay resultados.")).toBeInTheDocument()
    })

    it("con `empty`, la pantalla decide qué se muestra (sin datos o sin resultados)", () => {
        render(<DataTable columns={columns} data={[]} empty={<p>Todavía no hay reservas</p>} />)
        expect(screen.getByText("Todavía no hay reservas")).toBeInTheDocument()
        expect(screen.queryByText("No hay resultados.")).toBeNull()
    })

    it("con filas, `empty` no aparece", () => {
        render(<DataTable columns={columns} data={rows.slice(0, 1)} empty={<p>vacío</p>} />)
        expect(screen.queryByText("vacío")).toBeNull()
    })
})

describe("DataTable — onVisibleRowsChange", () => {
    it("avisa las filas de la página en pantalla y vuelve a avisar al cambiar de página", () => {
        const onVisibleRowsChange = vi.fn()
        render(<DataTable columns={columns} data={rows} onVisibleRowsChange={onVisibleRowsChange} />)

        expect(onVisibleRowsChange).toHaveBeenCalledTimes(1)
        expect(onVisibleRowsChange.mock.calls[0][0].map((r: Row) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        const buttons = screen.getAllByRole("button")
        fireEvent.click(buttons[buttons.length - 1])
        expect(onVisibleRowsChange).toHaveBeenCalledTimes(2)
        expect(onVisibleRowsChange.mock.calls[1][0].map((r: Row) => r.id)).toEqual([11, 12])
    })

    it("con getRowId, otra lista del mismo tamaño sí cuenta como filas nuevas", () => {
        const onVisibleRowsChange = vi.fn()
        const getRowId = (r: Row) => String(r.id)
        const { rerender } = render(
            <DataTable columns={columns} data={rows.slice(0, 3)} getRowId={getRowId} onVisibleRowsChange={onVisibleRowsChange} />,
        )
        rerender(
            <DataTable columns={columns} data={rows.slice(3, 6)} getRowId={getRowId} onVisibleRowsChange={onVisibleRowsChange} />,
        )
        expect(onVisibleRowsChange).toHaveBeenCalledTimes(2)
        expect(onVisibleRowsChange.mock.calls[1][0].map((r: Row) => r.id)).toEqual([4, 5, 6])
    })

    it("no vuelve a avisar cuando `data` cambia de identidad con las mismas filas", () => {
        const onVisibleRowsChange = vi.fn()
        const { rerender } = render(<DataTable columns={columns} data={rows} onVisibleRowsChange={onVisibleRowsChange} />)
        rerender(<DataTable columns={columns} data={rows.map((r) => ({ ...r }))} onVisibleRowsChange={onVisibleRowsChange} />)
        expect(onVisibleRowsChange).toHaveBeenCalledTimes(1)
    })

    it("avisa también la página siguiente, con el mismo orden", () => {
        const onVisibleRowsChange = vi.fn()
        render(<DataTable columns={columns} data={rows} onVisibleRowsChange={onVisibleRowsChange} />)
        const [visible, next] = onVisibleRowsChange.mock.calls[0]
        expect(visible).toHaveLength(10)
        expect(next.map((r: Row) => r.id)).toEqual([11, 12])
    })

    it("con orden controlado, pulsar un encabezado pide el orden y no ordena por su cuenta", () => {
        const onSortingChange = vi.fn()
        // La tabla pone su propio botón de orden en cada encabezado ordenable.
        render(<DataTable columns={columns} data={rows} sorting={[]} onSortingChange={onSortingChange} />)
        fireEvent.click(screen.getByRole("button", { name: /Nombre/ }))
        expect(onSortingChange).toHaveBeenCalledTimes(1)
        expect(screen.getAllByRole("row")[1]).toHaveTextContent("Fila 1")
    })
})

describe("DataTable — columna de cifras (`meta.align: \"end\"`)", () => {
    interface Money { id: number; label: string; amount: number }
    const moneyColumns: ColumnDef<Money>[] = [
        { accessorKey: "label", header: "Concepto" },
        { accessorKey: "amount", header: "Monto", meta: { align: "end" } },
    ]
    const money: Money[] = [{ id: 1, label: "A", amount: 10 }, { id: 2, label: "B", amount: 5 }]

    it("encabezado y celdas a la derecha; la flecha de orden va ANTES del rótulo", () => {
        render(<DataTable columns={moneyColumns} data={money} />)
        const head = screen.getByRole("columnheader", { name: "Monto" })
        expect(head).toHaveClass("text-right")
        expect(screen.getByRole("cell", { name: "10" })).toHaveClass("text-right")
        const sortButton = head.querySelector("button")!
        // El rótulo es lo último: termina donde terminan las cifras.
        expect(sortButton.lastChild?.textContent).toBe("Monto")
        expect(sortButton.firstElementChild).toHaveClass("lucide-chevrons-up-down")
    })

    it("sin `align`, todo sigue igual: rótulo primero y flecha después, a la izquierda", () => {
        render(<DataTable columns={moneyColumns} data={money} />)
        const head = screen.getByRole("columnheader", { name: "Concepto" })
        expect(head).not.toHaveClass("text-right")
        const sortButton = head.querySelector("button")!
        expect(sortButton.firstChild?.textContent).toBe("Concepto")
        expect(sortButton.lastElementChild).toHaveClass("lucide-chevrons-up-down")
    })
})
