import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CheckCircle2 } from "lucide-react"
import { IconBadge, iconBadgeVariants } from "./icon-badge"
import { Avatar, AvatarFallback } from "./avatar"

describe("IconBadge", () => {
    it("fondo sunk del tono y tinta del tono, sin borde", () => {
        const { container } = render(<IconBadge icon={CheckCircle2} tone="success" size="xl" />)
        const badge = container.querySelector('[data-slot="icon-badge"]')!
        expect(badge).toHaveClass("bg-success-sunk", "text-success", "size-24", "rounded-full")
        expect(badge.className).not.toMatch(/(?<![\w-])border(?![\w-])/)
        expect(badge).toHaveAttribute("aria-hidden", "true")
    })

    it("square usa el radio de la escala según el tamaño", () => {
        expect(iconBadgeVariants({ shape: "square", size: "sm" })).toContain("rounded-lg")
        expect(iconBadgeVariants({ shape: "square", size: "md" })).toContain("rounded-xl")
    })

    it("el ícono escala con el tamaño", () => {
        const { container } = render(<IconBadge icon={CheckCircle2} size="lg" />)
        expect(container.querySelector('[data-slot="icon"]')).toHaveAttribute("data-size", "2xl")
    })

    it("interactive sigue el hover del pulsable que lo contiene (tinte de selección); por omisión no", () => {
        const { container, rerender } = render(<IconBadge icon={CheckCircle2} interactive />)
        const badge = container.querySelector('[data-slot="icon-badge"]')!
        expect(badge).toHaveAttribute("data-interactive", "true")
        expect(badge).toHaveClass("group-hover:bg-primary/10", "group-hover:text-primary", "transition-colors")
        rerender(<IconBadge icon={CheckCircle2} />)
        expect(badge).not.toHaveAttribute("data-interactive")
        expect(badge).not.toHaveClass("group-hover:bg-primary/10")
    })
})

describe("Avatar — tono y tamaño desde la primitiva", () => {
    it("primary e inverse salen de `tone`, xl de `size`", () => {
        render(<><Avatar tone="primary" size="xl" data-testid="a"><AvatarFallback>AP</AvatarFallback></Avatar><Avatar tone="inverse" data-testid="b"><AvatarFallback>HG</AvatarFallback></Avatar></>)
        expect(screen.getByTestId("a")).toHaveAttribute("data-tone", "primary")
        expect(screen.getByTestId("a")).toHaveAttribute("data-size", "xl")
        expect(screen.getByText("AP").className).toContain("group-data-[tone=primary]/avatar:bg-primary/10")
        expect(screen.getByText("HG").className).toContain("group-data-[tone=inverse]/avatar:text-white")
    })
})
