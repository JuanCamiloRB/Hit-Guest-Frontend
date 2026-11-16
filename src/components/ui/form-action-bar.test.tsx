import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { FormActionBar } from "./form-action-bar"
import { bottomBarSurface } from "./bottom-bar"

describe("FormActionBar", () => {
    it("es una región con nombre, pegajosa al pie, con la superficie compartida de la barra al pie", () => {
        render(
            <FormActionBar status="* Campos obligatorios">
                <button type="button">Cancelar</button>
                <button type="submit">Guardar</button>
            </FormActionBar>,
        )
        const bar = screen.getByRole("region", { name: "Acciones del formulario" })
        expect(bar).toHaveAttribute("data-slot", "form-action-bar")
        expect(bar).toHaveClass("sticky", "bottom-0", "z-20", "w-full", "px-4", "sm:px-6")
        expect(bar).toHaveClass(...bottomBarSurface.split(" "))
        expect(bar).toHaveClass("bg-white/80", "backdrop-blur-md", "border-t", "border-rule/50", "py-4")
        // Geometría propia: nunca la de la BottomBar del portal.
        expect(bar).not.toHaveClass("fixed", "inset-x-0", "max-w-lg")

        const status = screen.getByText("* Campos obligatorios")
        expect(status).toHaveAttribute("data-slot", "form-action-bar-status")
        expect(status).toHaveClass("text-xs", "text-ink-3")
        const actions = screen.getByRole("button", { name: "Guardar" }).parentElement!
        expect(actions).toHaveAttribute("data-slot", "form-action-bar-actions")
        expect(actions).toHaveClass("flex", "gap-2")
        expect(actions).toContainElement(screen.getByRole("button", { name: "Cancelar" }))
    })

    it("sin status no deja un párrafo vacío; className es solo layout", () => {
        render(
            <FormActionBar className="-mx-4">
                <button type="submit">Guardar</button>
            </FormActionBar>,
        )
        const bar = screen.getByRole("region", { name: "Acciones del formulario" })
        expect(bar.querySelector('[data-slot="form-action-bar-status"]')).toBeNull()
        expect(bar).toHaveClass("-mx-4", "sticky", "bottom-0")
    })
})
