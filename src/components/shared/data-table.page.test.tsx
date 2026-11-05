import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ColumnDef } from "@tanstack/react-table"
import { describe, expect, it } from "vitest"
import { DataTable } from "./data-table"

interface Row { id: number; name: string }
const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Nombre" }]
const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Fila ${i + 1}` }))
const getRowId = (r: Row) => String(r.id)

describe("DataTable — la página no salta", () => {
    it("en la página 2, que lleguen datos nuevos para las MISMAS filas no devuelve a la 1", async () => {
        const { rerender } = render(<DataTable columns={columns} data={rows} getRowId={getRowId} />)
        // TanStack registra su reinicio automático en la primera microtarea.
        await act(async () => {})
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument()

        // Lo que pasa cuando llega un semáforo: mismas filas, objetos nuevos.
        rerender(<DataTable columns={columns} data={rows.map((r) => ({ ...r }))} getRowId={getRowId} />)
        // El reinicio de TanStack llegaría en una microtarea: se espera.
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument()
    })

    it("sí vuelve a la 1 cuando cambian las filas (una búsqueda) o el orden", async () => {
        const { rerender } = render(<DataTable columns={columns} data={rows} getRowId={getRowId} />)
        await act(async () => {})
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        rerender(<DataTable columns={columns} data={rows.slice(0, 22)} getRowId={getRowId} />)
        await act(async () => {})
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: /Nombre/ }))
        await act(async () => {})
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument()
    })
})
