import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"

import { MultiSelect } from "./multi-select"

globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const OPTIONS = [{ id: "a", name: "Aiana Verde" }, { id: "b", name: "Nomad House" }, { id: "c", name: "Torre Pravia" }]

function Demo({ onToggle = vi.fn() }: { onToggle?: (id: string) => void }) {
    const [selected, setSelected] = useState<Set<string>>(new Set())
    return (
        <MultiSelect
            label="Filtrar por propiedad"
            allLabel="Todas las propiedades"
            selectedWord="propiedades"
            options={OPTIONS}
            selected={selected}
            onToggle={(id) => { onToggle(id); setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }}
            onClear={() => setSelected(new Set())}
        />
    )
}

async function open() {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Filtrar por propiedad/ })) })
}

describe("MultiSelect", () => {
    it("el disparador es un campo con el nombre del filtro y lo elegido: todas, una o «N propiedades»", async () => {
        render(<Demo />)
        const trigger = screen.getByRole("button", { name: "Filtrar por propiedad: Todas las propiedades" })
        expect(trigger).toHaveAttribute("data-slot", "multi-select")
        await open()
        await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Nomad House" })) })
        expect(screen.getByRole("button", { name: "Filtrar por propiedad: Nomad House" })).toBeInTheDocument()
        await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Torre Pravia" })) })
        expect(screen.getByRole("button", { name: "Filtrar por propiedad: 2 propiedades" })).toBeInTheDocument()
    })

    it("una casilla por opción, nombrada por su Label (hermana, no la envuelve); «todas» limpia", async () => {
        const onToggle = vi.fn()
        render(<Demo onToggle={onToggle} />)
        await open()
        const group = screen.getByRole("group", { name: "Filtrar por propiedad" })
        expect(group.querySelectorAll('[role="checkbox"]')).toHaveLength(3)
        const box = screen.getByRole("checkbox", { name: "Aiana Verde" })
        expect(box.closest("label")).toBeNull()
        await act(async () => { fireEvent.click(box) })
        expect(onToggle).toHaveBeenCalledWith("a")
        expect(screen.getByRole("button", { name: "Todas las propiedades" })).toHaveAttribute("aria-pressed", "false")
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Todas las propiedades" })) })
        expect(screen.getByRole("button", { name: "Todas las propiedades" })).toHaveAttribute("aria-pressed", "true")
        expect(screen.getByRole("checkbox", { name: "Aiana Verde" })).not.toBeChecked()
    })

    it("sin opciones lo dice", async () => {
        render(<MultiSelect label="Filtrar por alojamiento" allLabel="Todos" options={[]} selected={new Set()} onToggle={() => {}} onClear={() => {}} />)
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Filtrar por alojamiento/ })) })
        expect(screen.getByText("Sin opciones")).toBeInTheDocument()
    })
})
