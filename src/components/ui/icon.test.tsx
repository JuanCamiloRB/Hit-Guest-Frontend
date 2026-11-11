import { Mail } from "lucide-react"
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Icon, ICON_SIZE } from "./icon"

describe("Icon", () => {
    it("es decorativo y mide 16 px por omisión", () => {
        const { container } = render(<Icon icon={Mail} />)
        const svg = container.querySelector("svg")!
        expect(svg).toHaveAttribute("aria-hidden", "true")
        expect(svg).toHaveAttribute("data-size", "md")
        expect(svg).toHaveAttribute("width", "16")
        expect(svg).toHaveClass("size-4", "shrink-0")
        expect(svg).toHaveAttribute("stroke-width", "2")
    })

    it.each(Object.entries(ICON_SIZE))("%s pinta su paso de la escala", (size, step) => {
        const { container } = render(<Icon icon={Mail} size={size as keyof typeof ICON_SIZE} />)
        const svg = container.querySelector("svg")!
        expect(svg).toHaveClass(step.className)
        expect(svg).toHaveAttribute("width", String(step.px))
    })

    it("con label es una imagen con nombre, no decorativa", () => {
        render(<Icon icon={Mail} label="Correo enviado" />)
        const img = screen.getByRole("img", { name: "Correo enviado" })
        expect(img).not.toHaveAttribute("aria-hidden")
    })

    it("el trazo sale del peso, no de un número suelto", () => {
        const { container } = render(<Icon icon={Mail} weight="bold" />)
        expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "3")
    })

    it("el className no puede cambiar el slot ni el tamaño declarado", () => {
        const { container } = render(<Icon icon={Mail} size="lg" className="text-ink-3" data-size="xs" />)
        const svg = container.querySelector("svg")!
        expect(svg).toHaveAttribute("data-size", "lg")
        expect(svg).toHaveAttribute("data-slot", "icon")
        expect(svg).toHaveClass("text-ink-3", "size-5")
    })
})
