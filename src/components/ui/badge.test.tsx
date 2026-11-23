import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge, badgeVariants } from "./badge"
import { StatusPill } from "./status-pill"

const TONES = ["neutral", "accent", "success", "warning", "danger", "info", "surface", "integration", "data"] as const

describe("Badge", () => {
    it("es una etiqueta neutral por omisión, sin punto de estado", () => {
        const { container } = render(<Badge>Token</Badge>)
        const badge = screen.getByText("Token")
        expect(badge).toHaveAttribute("data-tone", "neutral")
        expect(badge).toHaveClass("bg-neutral-sunk", "text-ink-2", "rounded-md", "text-xs")
        expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
    })

    it.each(TONES)("%s usa tokens, nunca colores de paleta ni rellenos sólidos de acción", (tone) => {
        const classes = badgeVariants({ tone })
        expect(classes).not.toMatch(/-(?:red|green|amber|blue|slate|gray)-\d/)
        expect(classes).not.toMatch(/(?:^|\s)bg-(?:primary|secondary|destructive)(?:\s|$)/)
    })

    it("integration: la conexión con un PMS, azul secundario al 10 % con texto secondary-hover", () => {
        render(<Badge tone="integration">KunasPMS</Badge>)
        expect(screen.getByText("KunasPMS")).toHaveClass("bg-secondary/10", "text-secondary-hover")
    })

    it("data: la cifra en morado claro con borde; se llena de primary-hover SOLO al pasar por la fila de una tabla", () => {
        render(<Badge tone="data">US$ 299</Badge>)
        const badge = screen.getByText("US$ 299")
        expect(badge).toHaveClass("border", "border-primary/30", "bg-primary/10", "text-primary-hover")
        expect(badge).toHaveClass("group-hover/row:bg-primary-hover", "group-hover/row:text-primary-foreground")
        // Fuera de una fila no hay hover propio: no es un control.
        expect(badge.className).not.toMatch(/(?:^|\s)hover:/)
    })

    it("size md: más alto y con más aire, para la celda cómoda; sm por omisión", () => {
        const { rerender } = render(<Badge>US$ 299</Badge>)
        expect(screen.getByText("US$ 299")).toHaveClass("px-1.5", "py-0.5")
        rerender(<Badge size="md">US$ 299</Badge>)
        expect(screen.getByText("US$ 299")).toHaveClass("min-h-7", "px-2.5", "py-1")
        expect(screen.getByText("US$ 299")).not.toHaveClass("px-1.5")
    })
})

describe("StatusPill — tono none", () => {
    it("el guion es decorativo (ink-4)", () => {
        render(<StatusPill tone="none" />)
        expect(screen.getByText("—")).toHaveClass("text-ink-4")
    })

    it("una palabra en su lugar es texto y va en ink-3 (AA)", () => {
        render(<StatusPill tone="none" emptyLabel="TRA" />)
        expect(screen.getByText("TRA")).toHaveClass("text-ink-3")
    })
})
