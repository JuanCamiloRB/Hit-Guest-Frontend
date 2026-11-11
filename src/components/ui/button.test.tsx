import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import NextLink from "next/link"
import { Button, buttonVariants } from "./button"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/" }))

const VARIANTS = [
    "default", "destructive", "outline", "secondary", "ghost", "link",
    "outline-destructive", "outline-warning", "ghost-destructive", "link-inherit", "inverse", "overlay", "field",
] as const

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

    it("foco visible: outline sólido de 2 px separado del botón", () => {
        // Foco: outline sólido (3:1, visible en alto contraste), nunca el anillo translúcido.
        const classes = buttonVariants().split(/\s+/)
        for (const cls of ["focus-visible:outline-solid", "focus-visible:outline-2", "focus-visible:outline-offset-2", "focus-visible:outline-ring"]) {
            expect(classes).toContain(cls)
        }
        for (const variant of VARIANTS) {
            expect(buttonVariants({ variant })).not.toMatch(/focus-visible:ring-/)
        }
    })

    it.each(["inverse", "overlay"] as const)("%s: sobre fondo oscuro el foco es blanco y reemplaza al morado", (variant) => {
        render(<Button variant={variant}>Copiar</Button>)
        const button = screen.getByRole("button", { name: "Copiar" })
        expect(button).toHaveClass("focus-visible:outline-white", "focus-visible:outline-solid")
        expect(button).not.toHaveClass("focus-visible:outline-ring")
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

    it("cargando: indicador, texto propio, aria-busy y aria-disabled; conserva el foco y no repite la acción", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(<Button loading loadingLabel="Guardando…" onClick={onClick}>Guardar cambios</Button>)
        const button = screen.getByRole("button", { name: "Guardando…" })
        expect(button).toHaveAttribute("aria-busy", "true")
        // No disponible para la tecnología asistiva, pero sin `disabled`: conserva el foco.
        expect(button).toHaveAttribute("aria-disabled", "true")
        expect(button).not.toHaveAttribute("disabled")
        expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
        await user.click(button)
        await user.click(button)
        expect(button).toHaveFocus()
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

    it("cargando conserva su color: los estilos de no disponible excluyen data-loading", () => {
        render(<Button loading loadingLabel="Guardando…">Guardar</Button>)
        const button = screen.getByRole("button", { name: "Guardando…" })
        expect(button).toHaveAttribute("data-loading", "true")
        expect(button).toHaveClass("bg-primary", "aria-disabled:not-data-loading:bg-sunk")
        expect(button).not.toHaveClass("aria-disabled:bg-sunk")
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

    it("enlace asChild con aria-disabled: ni ratón ni Enter ejecutan su propio onClick ni navegan", async () => {
        const own = vi.fn()
        const user = userEvent.setup()
        render(<Button asChild aria-disabled="true"><a href="/x" onClick={own}>Exportar</a></Button>)
        const link = screen.getByRole("link", { name: "Exportar" })
        await user.click(link)
        link.focus()
        await user.keyboard("{Enter}")
        expect(own).not.toHaveBeenCalled()
        // La navegación también queda cancelada.
        const click = new MouseEvent("click", { bubbles: true, cancelable: true })
        link.dispatchEvent(click)
        expect(click.defaultPrevented).toBe(true)
        expect(own).not.toHaveBeenCalled()
    })

    it("enlace asChild con NextLink, ocupado o deshabilitado: no ejecuta su onClick ni navega", async () => {
        const own = vi.fn()
        const user = userEvent.setup()
        const { rerender } = render(<Button asChild loading><NextLink href="/reservas" onClick={own}>Ver reservas</NextLink></Button>)
        await user.click(screen.getByRole("link", { name: "Ver reservas" }))
        rerender(<Button asChild aria-disabled="true"><NextLink href="/reservas" onClick={own}>Ver reservas</NextLink></Button>)
        const link = screen.getByRole("link", { name: "Ver reservas" })
        link.focus()
        await user.keyboard("{Enter}")
        expect(own).not.toHaveBeenCalled()
        expect(link).toHaveAttribute("aria-disabled", "true")
    })

    it("un clic bloqueado no llega al contenedor clicable (fila o tarjeta)", async () => {
        const parent = vi.fn()
        const user = userEvent.setup()
        render(
            <div onClick={parent} role="presentation">
                <Button loading loadingLabel="Guardando…">Guardar</Button>
                <Button aria-disabled>Archivar</Button>
            </div>,
        )
        await user.click(screen.getByRole("button", { name: "Guardando…" }))
        await user.click(screen.getByRole("button", { name: "Archivar" }))
        expect(parent).not.toHaveBeenCalled()
    })

    it("aria-disabled en un botón: Enter tampoco lo ejecuta", async () => {
        const onClick = vi.fn()
        const user = userEvent.setup()
        render(<Button aria-disabled onClick={onClick}>Archivar</Button>)
        screen.getByRole("button", { name: "Archivar" }).focus()
        await user.keyboard("{Enter}")
        expect(onClick).not.toHaveBeenCalled()
    })

    it("un color propio de la pantalla no anula el estado deshabilitado", () => {
        render(<Button disabled className="bg-brand-purple text-white hover:bg-brand-purple/90">Crear Reserva</Button>)
        const button = screen.getByRole("button", { name: "Crear Reserva" })
        expect(button).toHaveClass("bg-brand-purple", "disabled:bg-sunk", "disabled:text-ink-3")
    })

    it("no disponible: tampoco ejecuta el onClickCapture de quien lo usa; disponible, sí", async () => {
        const capture = vi.fn()
        const user = userEvent.setup()
        const { rerender } = render(<Button loading onClickCapture={capture}>Guardar</Button>)
        await user.click(screen.getByRole("button"))
        rerender(<Button aria-disabled onClickCapture={capture}>Guardar</Button>)
        await user.click(screen.getByRole("button"))
        expect(capture).not.toHaveBeenCalled()
        rerender(<Button onClickCapture={capture}>Guardar</Button>)
        await user.click(screen.getByRole("button"))
        expect(capture).toHaveBeenCalledTimes(1)
    })

    it("densidades: predeterminada 40/44 px, compacta 32 px y ningún tamaño por debajo de 32", () => {
        expect(buttonVariants({ size: "default" })).toMatch(/\bh-10\b/)
        expect(buttonVariants({ size: "icon" })).toMatch(/\bsize-10\b/)
        expect(buttonVariants({ size: "lg" })).toMatch(/\bh-11\b/)
        expect(buttonVariants({ size: "icon-lg" })).toMatch(/\bsize-11\b/)
        expect(buttonVariants({ size: "sm" })).toMatch(/\bh-8\b/)
        expect(buttonVariants({ size: "icon-sm" })).toMatch(/\bsize-8\b/)
        for (const size of ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"] as const) {
            // h-6 / h-7 / size-6 / size-7 = 24–28 px: por debajo del mínimo compacto.
            // Solo la altura del botón (clase suelta), no `[&_svg…]:size-4` del ícono.
            expect(buttonVariants({ size })).not.toMatch(/(^|\s)(h|size)-([1-7](\.5)?|\[(1?\d|2\d|3[01])px\])(\s|$)/)
        }
    })
})

describe("Button — variantes de DS-6", () => {
    it.each(["outline", "ghost"] as const)("%s con aria-pressed pinta el estado activo de un conmutador", (variant) => {
        render(<Button variant={variant} aria-pressed>Solo con consumo</Button>)
        const button = screen.getByRole("button", { name: "Solo con consumo", pressed: true })
        expect(button).toHaveClass("aria-pressed:bg-primary/10", "aria-pressed:text-primary")
    })

    it("field: forma de campo y tinta de marcador mientras no hay valor", () => {
        render(<Button variant="field" data-placeholder>Fechas</Button>)
        const button = screen.getByRole("button", { name: "Fechas" })
        expect(button).toHaveClass("border-input", "hover:border-input-hover", "data-placeholder:text-ink-3", "font-normal")
        expect(button).not.toHaveClass("font-medium")
        expect(button).toHaveAttribute("data-placeholder")
    })

    it("inline toma el tamaño del texto que lo rodea", () => {
        render(<p className="text-xs">¿No llegó? <Button variant="link" size="inline">Reenviar</Button></p>)
        const button = screen.getByRole("button", { name: "Reenviar" })
        expect(button).toHaveClass("[font-size:inherit]", "[line-height:inherit]", "p-0")
        expect(button).not.toHaveClass("h-10")
    })

    it("xl es la acción del portal: 48 px", () => {
        render(<Button size="xl">Continuar</Button>)
        expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass("h-12")
    })

    it("los destructivos y el de aviso usan los tokens de estado, nunca rojo o ámbar de paleta", () => {
        expect(buttonVariants({ variant: "outline-destructive" })).toMatch(/text-danger/)
        expect(buttonVariants({ variant: "ghost-destructive" })).toMatch(/hover:bg-danger-sunk/)
        expect(buttonVariants({ variant: "outline-warning" })).toMatch(/text-warning/)
        for (const variant of VARIANTS) expect(buttonVariants({ variant })).not.toMatch(/-(?:red|amber|orange)-\d/)
    })
})
