import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { SearchField } from "./search-field"

describe("SearchField", () => {
    it("es un campo de búsqueda con nombre y la lupa en primary a la izquierda", () => {
        const onChange = vi.fn()
        const { container } = render(<SearchField label="Buscar reservas" value="" onChange={onChange} />)
        const input = screen.getByRole("searchbox", { name: "Buscar reservas" })
        expect(input).toHaveAttribute("data-slot", "input")
        expect(input).toHaveClass("pl-9", "h-10")
        expect(container.querySelector(".lucide-search")).toHaveClass("text-primary", "pointer-events-none", "absolute")
        fireEvent.change(input, { target: { value: "Ana" } })
        expect(onChange).toHaveBeenCalled()
    })

    it("tamaños: sm 36 px, lg 44 px; className solo en el contenedor", () => {
        const { rerender, container } = render(<SearchField label="x" size="sm" className="w-64" />)
        expect(screen.getByRole("searchbox")).toHaveClass("h-9")
        expect(container.querySelector('[data-slot="search-field"]')).toHaveClass("relative", "w-64")
        expect(screen.getByRole("searchbox")).not.toHaveClass("w-64")
        rerender(<SearchField label="x" size="lg" />)
        expect(screen.getByRole("searchbox")).toHaveClass("h-11")
    })

    it("sin label lo nombra el Label de la pantalla por id", () => {
        render(<><label htmlFor="q">Buscar cliente</label><SearchField id="q" /></>)
        expect(screen.getByRole("searchbox", { name: "Buscar cliente" })).toBeInTheDocument()
    })
})
