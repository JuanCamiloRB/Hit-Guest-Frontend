import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { useState } from "react"

globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

import { CheckboxCard } from "./checkbox-card"

describe("CheckboxCard", () => {
    it("la etiqueta nombra la casilla y la descripción la describe sin entrar en el nombre", () => {
        render(<CheckboxCard label="Wifi" description="Incluido en la tarifa" checked={false} onCheckedChange={() => {}} />)
        const box = screen.getByRole("checkbox", { name: "Wifi" })
        expect(box).toHaveAccessibleDescription("Incluido en la tarifa")
        // Hermanos: la etiqueta NO envuelve el botón de Radix.
        expect(screen.getByText("Wifi").contains(box)).toBe(false)
        expect(screen.getByText("Wifi").closest("label")).toHaveAttribute("for", box.id)
    })

    it("un clic en el texto activa la casilla UNA sola vez; un clic en la caja, otra", async () => {
        const user = userEvent.setup()
        const onCheckedChange = vi.fn()
        render(<CheckboxCard label="Wifi" checked={false} onCheckedChange={onCheckedChange} />)
        await user.click(screen.getByText("Wifi"))
        expect(onCheckedChange).toHaveBeenCalledTimes(1)
        expect(onCheckedChange).toHaveBeenCalledWith(true)

        onCheckedChange.mockClear()
        await user.click(screen.getByRole("checkbox", { name: "Wifi" }))
        expect(onCheckedChange).toHaveBeenCalledTimes(1)
        expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it("un clic en el relleno de la tarjeta también activa una sola vez", async () => {
        const user = userEvent.setup()
        const onCheckedChange = vi.fn()
        render(<CheckboxCard label="Wifi" description="Incluido" checked onCheckedChange={onCheckedChange} />)
        await user.click(screen.getByText("Incluido"))
        expect(onCheckedChange).toHaveBeenCalledTimes(1)
        expect(onCheckedChange).toHaveBeenCalledWith(false)
    })

    it("Espacio la activa desde el teclado", async () => {
        const user = userEvent.setup()
        const onCheckedChange = vi.fn()
        render(<CheckboxCard label="Wifi" checked={false} onCheckedChange={onCheckedChange} />)
        screen.getByRole("checkbox", { name: "Wifi" }).focus()
        await user.keyboard(" ")
        expect(onCheckedChange).toHaveBeenCalledTimes(1)
        expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it("marcada es una Surface «selected» plana e interactiva; sin marcar, la base", () => {
        const { rerender } = render(<CheckboxCard label="Wifi" checked onCheckedChange={() => {}} />)
        const card = () => document.querySelector('[data-slot="checkbox-card"]')!
        expect(card()).toHaveAttribute("data-tone", "selected")
        expect(card()).toHaveAttribute("data-checked", "true")
        expect(card()).toHaveAttribute("data-interactive", "true")
        expect(card()).toHaveAttribute("data-flat", "true")
        expect(card()).toHaveClass("border-primary/30", "bg-primary/5", "rounded-lg", "min-h-11", "gap-3", "px-3", "py-2.5")
        expect(screen.getByText("Wifi")).toHaveClass("text-sm", "font-medium", "text-ink")

        rerender(<CheckboxCard label="Wifi" checked={false} onCheckedChange={() => {}} />)
        expect(card()).toHaveAttribute("data-tone", "default")
        expect(card()).not.toHaveAttribute("data-checked")
        expect(card()).toHaveClass("hover:border-input-hover")
    })

    it("deshabilitada: la casilla no cambia ni desde el texto, y se ve hundida en ink-3", async () => {
        const user = userEvent.setup()
        const onCheckedChange = vi.fn()
        render(<CheckboxCard label="Wifi" checked={false} disabled onCheckedChange={onCheckedChange} />)
        const box = screen.getByRole("checkbox", { name: "Wifi" })
        expect(box).toBeDisabled()
        await user.click(screen.getByText("Wifi"))
        await user.click(box)
        expect(onCheckedChange).not.toHaveBeenCalled()
        const card = document.querySelector('[data-slot="checkbox-card"]')!
        expect(card).toHaveAttribute("data-disabled", "true")
        expect(card).not.toHaveAttribute("data-interactive")
        expect(card).toHaveClass("bg-sunk", "text-ink-3", "cursor-not-allowed")
    })

    it("en una grilla, cada tarjeta tiene su id y responde por separado", async () => {
        const user = userEvent.setup()
        const onWifi = vi.fn()
        const onPool = vi.fn()
        const onParking = vi.fn()
        render(
            <div className="grid grid-cols-3 gap-3">
                <CheckboxCard label="Wifi" checked={false} onCheckedChange={onWifi} />
                <CheckboxCard id="pool" label="Piscina" checked={false} onCheckedChange={onPool} />
                <CheckboxCard label="Parqueadero" checked={false} onCheckedChange={onParking} />
            </div>,
        )
        const boxes = screen.getAllByRole("checkbox")
        const ids = boxes.map((box) => box.id)
        expect(new Set(ids).size).toBe(3)
        expect(screen.getByRole("checkbox", { name: "Piscina" })).toHaveAttribute("id", "pool")

        await user.click(screen.getByText("Piscina"))
        expect(onPool).toHaveBeenCalledTimes(1)
        expect(onWifi).not.toHaveBeenCalled()
        expect(onParking).not.toHaveBeenCalled()
    })
})

describe("CheckboxCard dentro de un <form> (Radix emite un <input> oculto que despacha su propio click)", () => {
    function Form() {
        const [checked, setChecked] = useState(false)
        return (
            <form onSubmit={(e) => e.preventDefault()}>
                <CheckboxCard label="Wifi" name="amenities" value="1" checked={checked} onCheckedChange={setChecked} />
            </form>
        )
    }

    it("un clic en el texto marca UNA vez y se queda marcada (sin bucle de re-marcado)", async () => {
        const user = userEvent.setup()
        render(<Form />)
        await user.click(screen.getByText("Wifi"))
        expect(screen.getByRole("checkbox", { name: "Wifi" })).toHaveAttribute("aria-checked", "true")
        // El input oculto del formulario refleja el valor, y no vuelve a disparar la tarjeta.
        expect(document.querySelector<HTMLInputElement>('input[name="amenities"]')?.checked).toBe(true)
    })

    it("un clic en la caja también marca una vez, y el siguiente desmarca", async () => {
        const user = userEvent.setup()
        render(<Form />)
        const box = screen.getByRole("checkbox", { name: "Wifi" })
        await user.click(box)
        expect(box).toHaveAttribute("aria-checked", "true")
        await user.click(box)
        expect(box).toHaveAttribute("aria-checked", "false")
    })
})
