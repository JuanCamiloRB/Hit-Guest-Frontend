import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Checkbox } from "./checkbox"
import { Switch } from "./switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

describe("Checkbox", () => {
    it("sin marcar se distingue (borde ink-3), tiene área táctil ampliada y se marca con Espacio", async () => {
        const user = userEvent.setup()
        render(<Checkbox aria-label="Acepto" />)
        const box = screen.getByRole("checkbox", { name: "Acepto" })
        expect(box).toHaveClass("border-ink-3", "relative", "after:-inset-1", "focus-visible:ring-[3px]")
        expect(box).not.toHaveClass("border-input")
        box.focus()
        await user.keyboard(" ")
        expect(box).toHaveAttribute("aria-checked", "true")
        // Marcada: palomita (no solo el color).
        expect(box.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    })

    it("deshabilitada no cambia", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Checkbox aria-label="Acepto" disabled onCheckedChange={onChange} />)
        await user.click(screen.getByRole("checkbox", { name: "Acepto" }))
        expect(onChange).not.toHaveBeenCalled()
    })
})

describe("Checkbox — etiqueta y teclado", () => {
    it("envuelta en una etiqueta: un clic en el texto la marca una sola vez; Enter no la marca", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<label><Checkbox onCheckedChange={onChange} /> Casa Mar</label>)
        await user.click(screen.getByText("Casa Mar"))
        expect(onChange).toHaveBeenCalledTimes(1)
        const box = screen.getByRole("checkbox", { name: "Casa Mar" })
        box.focus()
        await user.keyboard("{Enter}")
        expect(onChange).toHaveBeenCalledTimes(1)
    })
})

describe("Switch", () => {
    it("apagado se distingue (pista ink-3), área táctil ampliada, se activa con Espacio", async () => {
        const user = userEvent.setup()
        render(<Switch aria-label="Notificaciones" />)
        const control = screen.getByRole("switch", { name: "Notificaciones" })
        expect(control).toHaveClass("data-[state=unchecked]:bg-ink-3", "relative", "after:-inset-y-2.5")
        expect(control).not.toHaveClass("data-[state=unchecked]:bg-input")
        control.focus()
        await user.keyboard(" ")
        expect(control).toHaveAttribute("aria-checked", "true")
    })

    it("deshabilitado no cambia", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(<Switch aria-label="Notificaciones" disabled onCheckedChange={onChange} />)
        await user.click(screen.getByRole("switch", { name: "Notificaciones" }))
        expect(onChange).not.toHaveBeenCalled()
    })
})

describe("Tabs", () => {
    it("inactiva en ink-3, activa en ink sobre pastilla card; las flechas mueven y activan", async () => {
        const user = userEvent.setup()
        render(
            <Tabs defaultValue="a">
                <TabsList>
                    <TabsTrigger value="a">Detalles</TabsTrigger>
                    <TabsTrigger value="b">Fotos</TabsTrigger>
                </TabsList>
                <TabsContent value="a">Contenido A</TabsContent>
                <TabsContent value="b">Contenido B</TabsContent>
            </Tabs>,
        )
        const first = screen.getByRole("tab", { name: "Detalles" })
        const second = screen.getByRole("tab", { name: "Fotos" })
        expect(second).toHaveClass("text-ink-3", "data-[state=active]:bg-card", "data-[state=active]:text-ink")
        expect(second.className).not.toMatch(/text-foreground\/60|font-semibold/)
        first.focus()
        await user.keyboard("{ArrowRight}")
        expect(second).toHaveFocus()
        expect(second).toHaveAttribute("aria-selected", "true")
        expect(screen.getByText("Contenido B")).toBeInTheDocument()
        await user.keyboard("{Home}")
        expect(first).toHaveFocus()
        await user.keyboard("{End}")
        expect(second).toHaveFocus()
    })
})

describe("Select", () => {
    it("placeholder ink-3, deshabilitado legible, y se maneja con teclado", async () => {
        const onChange = vi.fn()
        const user = userEvent.setup()
        render(
            <Select onValueChange={onChange}>
                <SelectTrigger aria-label="País"><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="co">Colombia</SelectItem>
                    <SelectItem value="mx">México</SelectItem>
                </SelectContent>
            </Select>,
        )
        const trigger = screen.getByRole("combobox", { name: "País" })
        expect(trigger).toHaveClass("data-[placeholder]:text-ink-3", "disabled:bg-sunk", "disabled:text-ink-3")
        expect(trigger.className).not.toMatch(/disabled:opacity-50/)
        trigger.focus()
        await user.keyboard("{Enter}")
        await screen.findByRole("option", { name: "Colombia" })
        await user.keyboard("{ArrowDown}{Enter}")
        expect(onChange).toHaveBeenCalledWith("mx")
    })

    it("deshabilitado: no se abre, sin sombra y con la flecha atenuada", async () => {
        const user = userEvent.setup()
        render(
            <Select disabled>
                <SelectTrigger aria-label="Alojamiento"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent><SelectItem value="l1">Suite</SelectItem></SelectContent>
            </Select>,
        )
        const trigger = screen.getByRole("combobox", { name: "Alojamiento" })
        expect(trigger).toBeDisabled()
        expect(trigger).toHaveClass("disabled:shadow-none", "disabled:[&_svg:not([class*='text-'])]:text-ink-4")
        await user.click(trigger)
        expect(screen.queryByRole("option")).toBeNull()
    })

    it("la palomita de la opción enfocada pasa a blanco sobre el morado", async () => {
        const user = userEvent.setup()
        render(
            <Select defaultValue="co">
                <SelectTrigger aria-label="País"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="co">Colombia</SelectItem><SelectItem value="mx">México</SelectItem></SelectContent>
            </Select>,
        )
        await user.click(screen.getByRole("combobox", { name: "País" }))
        expect(await screen.findByRole("option", { name: "Colombia" })).toHaveClass("focus:[&_svg:not([class*='text-'])]:text-primary-foreground")
    })
})

