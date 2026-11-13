import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BottomBar } from "./bottom-bar"
import { Progress } from "./progress"
import { Disclosure } from "./disclosure"

describe("BottomBar", () => {
    it("fija la barra al pie con vidrio y divisor; className es el layout del contenido", () => {
        render(
            <BottomBar className="flex gap-3">
                <button type="button">Continuar</button>
            </BottomBar>,
        )
        const bar = document.querySelector('[data-slot="bottom-bar"]')!
        expect(bar).toHaveClass("fixed", "inset-x-0", "bottom-0", "z-10", "bg-white/80", "backdrop-blur-md", "border-t", "border-rule/50", "py-4")
        // El relleno horizontal va en el contenido, como el <main> del portal
        // (max-w-lg + px-4): si va en la barra, el botón sobresale 16 px por lado.
        expect(bar).not.toHaveClass("p-4", "px-4")
        const content = screen.getByRole("button", { name: "Continuar" }).parentElement!
        expect(content).toHaveAttribute("data-slot", "bottom-bar-content")
        expect(content).toHaveClass("w-full", "max-w-lg", "px-4", "flex", "gap-3")
        expect(bar).not.toHaveClass("gap-3")
    })
})

describe("Progress", () => {
    it("es una barra de progreso con nombre y valores accesibles", () => {
        render(<Progress value={2} max={5} label="Paso 2 de 5" size="xs" />)
        const bar = screen.getByRole("progressbar", { name: "Paso 2 de 5" })
        expect(bar).toHaveAttribute("aria-valuenow", "2")
        expect(bar).toHaveAttribute("aria-valuemax", "5")
        expect(bar).toHaveClass("h-1", "rounded-full", "bg-sunk")
        const indicator = bar.querySelector('[data-slot="progress-indicator"]')!
        expect(indicator).toHaveStyle({ width: "40%" })
        expect(indicator).toHaveClass("bg-primary", "min-w-0.5")
    })

    it("recorta el valor; un max inválido deja la barra vacía; en cero no fuerza ancho mínimo", () => {
        const { rerender } = render(<Progress value={150} label="Avance" />)
        let indicator = screen.getByRole("progressbar").querySelector('[data-slot="progress-indicator"]')!
        expect(indicator).toHaveStyle({ width: "100%" })

        // «1 de 0 completados» no es un porcentaje: nada que mostrar.
        rerender(<Progress value={3} max={0} label="Avance" />)
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
        indicator = screen.getByRole("progressbar").querySelector('[data-slot="progress-indicator"]')!
        expect(indicator).toHaveStyle({ width: "0%" })

        rerender(<Progress value={0} max={4} label="Avance" />)
        indicator = screen.getByRole("progressbar").querySelector('[data-slot="progress-indicator"]')!
        expect(indicator).toHaveStyle({ width: "0%" })
        expect(indicator).not.toHaveClass("min-w-0.5")
    })

    it("success pinta el avance en verde", () => {
        render(<Progress value={5} max={5} tone="success" size="md" label="Completado" />)
        const bar = screen.getByRole("progressbar")
        expect(bar).toHaveAttribute("data-tone", "success")
        expect(bar).toHaveClass("h-2")
        expect(bar.querySelector('[data-slot="progress-indicator"]')).toHaveClass("bg-success")
    })
})

describe("Disclosure", () => {
    it("el título es un botón que abre y cierra el contenido; cerrado, el contenido no está", async () => {
        const user = userEvent.setup()
        render(<Disclosure title="¿Me cobran algo ahora?"><p>No. Solo se registra como garantía.</p></Disclosure>)
        const trigger = screen.getByRole("button", { name: "¿Me cobran algo ahora?" })
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        expect(screen.queryByText("No. Solo se registra como garantía.")).toBeNull()

        await user.click(trigger)
        expect(trigger).toHaveAttribute("aria-expanded", "true")
        const body = screen.getByText("No. Solo se registra como garantía.")
        expect(trigger).toHaveAttribute("aria-controls", body.closest('[data-slot="disclosure-content"]')!.id)

        await user.click(trigger)
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        expect(screen.queryByText("No. Solo se registra como garantía.")).toBeNull()
    })

    it("defaultOpen arranca abierto; la variante inline es texto xs", () => {
        render(
            <>
                <Disclosure title="¿Por qué piden una tarjeta?" defaultOpen><p>Como respaldo.</p></Disclosure>
                <Disclosure variant="inline" title="Información técnica"><ul><li>Clave 0</li></ul></Disclosure>
            </>,
        )
        expect(screen.getByRole("button", { name: "¿Por qué piden una tarjeta?" })).toHaveAttribute("aria-expanded", "true")
        const inline = screen.getByRole("button", { name: "Información técnica" })
        expect(inline).toHaveClass("text-xs", "text-ink-3")
        // Foco visible como Button (outline sólido), nunca el anillo rechazado; cursor de pulsable.
        expect(inline).toHaveClass("focus-visible:outline-solid", "focus-visible:outline-2", "focus-visible:outline-ring", "cursor-pointer")
        expect(inline.className).not.toMatch(/ring-\[3px\]|ring-ring/)
        expect(inline.closest('[data-slot="disclosure"]')).toHaveAttribute("data-variant", "inline")
        expect(screen.getByRole("button", { name: "¿Por qué piden una tarjeta?" })).toHaveClass("text-sm", "font-semibold")
    })
})
