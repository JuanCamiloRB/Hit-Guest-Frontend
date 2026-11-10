import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button, buttonVariants } from "./button"

const VARIANTS = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const

describe("Button — estados", () => {
    it("ninguna variante escala ni desplaza; hover y active usan color explícito, no opacidad", () => {
        for (const variant of VARIANTS) {
            const classes = buttonVariants({ variant })
            expect(classes).not.toMatch(/scale|translate|hover:opacity|\/90\b|\/80\b/)
        }
        expect(buttonVariants({ variant: "default" })).toMatch(/hover:bg-primary-hover/)
        expect(buttonVariants({ variant: "default" })).toMatch(/active:bg-primary-hover/)
        expect(buttonVariants({ variant: "secondary" })).toMatch(/active:bg-secondary-hover/)
        expect(buttonVariants({ variant: "destructive" })).toMatch(/active:bg-destructive-hover/)
    })

    it("foco visible de 3 px", () => {
        expect(buttonVariants()).toMatch(/focus-visible:ring-\[3px\]/)
    })

    it("deshabilitado: legible (sunk + ink-3), cursor not-allowed y sin eventos", () => {
        const onClick = vi.fn()
        render(<Button disabled onClick={onClick}>Guardar</Button>)
        const button = screen.getByRole("button", { name: "Guardar" })
        expect(button).toBeDisabled()
        expect(button).toHaveClass("disabled:bg-sunk", "disabled:text-ink-3", "disabled:cursor-not-allowed")
        expect(button).not.toHaveClass("disabled:opacity-50")
        fireEvent.click(button)
        expect(onClick).not.toHaveBeenCalled()
    })

    it("cargando: indicador, texto propio, aria-busy; sigue enfocable y no repite la acción", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(<Button loading loadingLabel="Guardando…" onClick={onClick}>Guardar cambios</Button>)
        const button = screen.getByRole("button", { name: "Guardando…" })
        expect(button).toHaveAttribute("aria-busy", "true")
        expect(button).toBeEnabled()
        expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
        button.focus()
        expect(button).toHaveFocus()
        await user.click(button)
        await user.click(button)
        expect(onClick).not.toHaveBeenCalled()
    })

    it("cargando dentro de un formulario: no lo vuelve a enviar (clic ni Enter)", async () => {
        const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
        const user = userEvent.setup()
        render(
            <form onSubmit={onSubmit}>
                <input aria-label="Nombre" />
                <Button type="submit" loading loadingLabel="Guardando…">Guardar</Button>
            </form>,
        )
        await user.click(screen.getByRole("button", { name: "Guardando…" }))
        await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Ada{Enter}")
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it("sin loading se comporta como siempre", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(<Button onClick={onClick}>Guardar</Button>)
        const button = screen.getByRole("button", { name: "Guardar" })
        expect(button).not.toHaveAttribute("aria-busy")
        await user.click(button)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("asChild sigue funcionando, también cargando (el indicador entra en el enlace)", () => {
        const { rerender } = render(<Button asChild><a href="/reservas">Ver reservas</a></Button>)
        const link = screen.getByRole("link", { name: "Ver reservas" })
        expect(link).toHaveAttribute("data-slot", "button")

        rerender(<Button asChild loading loadingLabel="Ignorado"><a href="/reservas">Ver reservas</a></Button>)
        const busy = screen.getByRole("link", { name: "Ver reservas" })
        expect(busy).toHaveAttribute("aria-busy", "true")
        expect(busy.querySelector("svg")).toBeInTheDocument()
        const click = new MouseEvent("click", { bubbles: true, cancelable: true })
        busy.dispatchEvent(click)
        expect(click.defaultPrevented).toBe(true)
    })

    it("un enlace deshabilitado (asChild) se bloquea con aria-disabled", () => {
        render(<Button asChild aria-disabled="true"><a href="/x">Exportar</a></Button>)
        expect(screen.getByRole("link", { name: "Exportar" })).toHaveClass("aria-disabled:pointer-events-none")
    })

    it("cargando: Espacio y Enter con teclado tampoco repiten la acción", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(<Button loading loadingLabel="Guardando…" onClick={onClick}>Guardar</Button>)
        screen.getByRole("button", { name: "Guardando…" }).focus()
        await user.keyboard(" ")
        await user.keyboard("{Enter}")
        expect(onClick).not.toHaveBeenCalled()
    })

    it("aria-disabled bloquea también el teclado (enlace con asChild y botón)", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(<>
            <Button asChild aria-disabled="true" onClick={onClick}><a href="/x">Exportar</a></Button>
            <Button aria-disabled onClick={onClick}>Archivar</Button>
        </>)
        screen.getByRole("link", { name: "Exportar" }).focus()
        await user.keyboard("{Enter}")
        screen.getByRole("button", { name: "Archivar" }).focus()
        await user.keyboard("{Enter}")
        expect(onClick).not.toHaveBeenCalled()
    })

    it("un color propio de la pantalla no anula el estado deshabilitado", () => {
        render(<Button disabled className="bg-brand-purple text-white hover:bg-brand-purple/90">Crear Reserva</Button>)
        const button = screen.getByRole("button", { name: "Crear Reserva" })
        expect(button).toHaveClass("bg-brand-purple", "disabled:bg-sunk", "disabled:text-ink-3")
    })
})

