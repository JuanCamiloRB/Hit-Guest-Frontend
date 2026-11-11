import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge, badgeVariants } from "./badge"
import { StatusPill } from "./status-pill"

const TONES = ["neutral", "accent", "success", "warning", "danger", "info", "surface"] as const

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
