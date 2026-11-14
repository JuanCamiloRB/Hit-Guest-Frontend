import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CheckboxField } from "./checkbox-field"

describe("CheckboxField", () => {
    it("el texto activa la casilla una sola vez y le da un nombre accesible", async () => {
        const onCheckedChange = vi.fn()
        render(<CheckboxField label="Acepto el contrato" onCheckedChange={onCheckedChange} />)
        await userEvent.setup().click(screen.getByText("Acepto el contrato"))
        expect(onCheckedChange).toHaveBeenCalledTimes(1)
        expect(onCheckedChange).toHaveBeenCalledWith(true)
        expect(screen.getByRole("checkbox", { name: "Acepto el contrato" })).toBeInTheDocument()
    })

    it("una acción relacionada no activa la casilla", async () => {
        const onCheckedChange = vi.fn()
        render(
            <CheckboxField
                label="Acepto el contrato"
                action={<a href="/terminos">Ver términos</a>}
                onCheckedChange={onCheckedChange}
            />,
        )
        await userEvent.setup().click(screen.getByRole("link", { name: "Ver términos" }))
        expect(onCheckedChange).not.toHaveBeenCalled()
    })

    it("conserva teclado y estado deshabilitado", async () => {
        const onCheckedChange = vi.fn()
        const { rerender } = render(<CheckboxField label="Acepto" onCheckedChange={onCheckedChange} />)
        const checkbox = screen.getByRole("checkbox", { name: "Acepto" })
        checkbox.focus()
        await userEvent.setup().keyboard(" ")
        expect(onCheckedChange).toHaveBeenCalledWith(true)

        onCheckedChange.mockClear()
        rerender(<CheckboxField label="Acepto" disabled onCheckedChange={onCheckedChange} />)
        await userEvent.setup().click(screen.getByText("Acepto"))
        expect(onCheckedChange).not.toHaveBeenCalled()
    })

    it("la etiqueta ocupa toda la fila de texto (no solo los glifos) y deshabilitada se ve en ink-3", () => {
        const { rerender } = render(<CheckboxField label="Acepto" />)
        expect(screen.getByText("Acepto")).toHaveClass("block", "cursor-pointer")
        expect(screen.getByText("Acepto").parentElement).toHaveClass("text-ink-2")
        rerender(<CheckboxField label="Acepto" disabled />)
        expect(screen.getByText("Acepto").parentElement).toHaveClass("text-ink-3")
        expect(screen.getByText("Acepto")).toHaveClass("cursor-not-allowed")
    })
})
