import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"
import { EmptyState } from "./empty-state"
import { LoadingState, RefreshIndicator } from "./loading-state"
import { Skeleton } from "./skeleton"

/** Atributos de anuncio que una pantalla podría intentar colar con un spread. */
const injected = {
    role: "alert",
    "aria-live": "assertive",
    "aria-atomic": "false",
    "aria-relevant": "removals",
    "aria-busy": "true",
    "data-slot": "otro",
} as unknown as Record<string, never>

describe("LoadingState — carga inicial", () => {
    it.each(["rows", "spinner"] as const)("%s: status con nombre, anunciado sin interrumpir", (variant) => {
        render(<LoadingState variant={variant} label="Cargando reservas…" />)
        const status = screen.getByRole("status", { name: "Cargando reservas…" })
        expect(status).toHaveAttribute("aria-live", "polite")
        expect(status).toHaveAttribute("data-variant", variant)
    })

    it("rows imita la lista: tantas filas como se pidan, ocultas al lector", () => {
        const { container } = render(<LoadingState rows={3} />)
        const rows = container.querySelectorAll("[data-slot=loading-state] > [aria-hidden=true]")
        expect(rows).toHaveLength(3)
        expect(rows[0].querySelectorAll("[data-slot=skeleton]").length).toBeGreaterThan(0)
    })

    it.each(["rows", "spinner"] as const)("%s: un spread no cambia cómo se anuncia", (variant) => {
        const { container } = render(<LoadingState {...injected} variant={variant} label="Cargando…" />)
        const el = container.firstElementChild!
        expect(el).toHaveAttribute("role", "status")
        expect(el).toHaveAttribute("aria-live", "polite")
        expect(el).toHaveAttribute("aria-atomic", "true")
        expect(el).not.toHaveAttribute("aria-busy")
        expect(el).not.toHaveAttribute("aria-relevant")
        expect(el).toHaveAttribute("data-slot", "loading-state")
    })
})

describe("RefreshIndicator — actualización con los datos a la vista", () => {
    it("la región status existe siempre; inactiva está vacía y no se ve", () => {
        const { container } = render(<RefreshIndicator active={false} />)
        const region = screen.getByRole("status")
        expect(region).toBeEmptyDOMElement()
        expect(region).toHaveClass("sr-only")
        expect(container.querySelector("svg")).toBeNull()
    })

    it("al activarse cambia el contenido de la MISMA región (así el anuncio es fiable)", () => {
        const { rerender } = render(<RefreshIndicator active={false} label="Actualizando reservas…" />)
        const before = screen.getByRole("status")
        rerender(<RefreshIndicator active label="Actualizando reservas…" />)
        const after = screen.getByRole("status")
        expect(after).toBe(before)
        expect(after).toHaveTextContent("Actualizando reservas…")
        expect(after).not.toHaveClass("sr-only")
        expect(after).toHaveClass("text-ink-3")
        expect(after.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    })

    it("un spread no cambia cómo se anuncia", () => {
        render(<RefreshIndicator {...injected} active />)
        const region = screen.getByRole("status")
        expect(region).toHaveAttribute("aria-live", "polite")
        expect(region).not.toHaveAttribute("aria-busy")
        expect(region).not.toHaveAttribute("aria-relevant")
        expect(region).toHaveAttribute("data-slot", "refresh-indicator")
    })
})

describe("EmptyState — sin datos vs. sin resultados", () => {
    it("empty (por defecto): parte fija, no se anuncia", () => {
        render(<EmptyState title="Todavía no hay reservas" action={<Button size="sm">Crear reserva</Button>} />)
        expect(screen.queryByRole("status")).toBeNull()
        expect(screen.getByText("Todavía no hay reservas").closest("[data-slot=empty-state]")).toHaveAttribute("data-kind", "empty")
        expect(screen.getByRole("button", { name: "Crear reserva" })).toBeInTheDocument()
    })

    it("no-results: se anuncia sin interrumpir, con la acción que deshace el filtro", () => {
        render(
            <EmptyState
                kind="no-results"
                title="Sin resultados para «Casa Mar»"
                description="Prueba con otro nombre o limpia los filtros."
                action={<Button size="sm" variant="outline">Limpiar filtros</Button>}
            />,
        )
        const status = screen.getByRole("status")
        expect(status).toHaveAttribute("aria-live", "polite")
        expect(status).toHaveTextContent("Sin resultados para «Casa Mar»")
        expect(status).toContainElement(screen.getByRole("button", { name: "Limpiar filtros" }))
    })

    it("el ícono es decorativo", () => {
        render(<EmptyState title="Vacío" icon={<span data-testid="icono">★</span>} />)
        expect(screen.getByTestId("icono").parentElement).toHaveAttribute("aria-hidden", "true")
    })

    it.each([
        ["empty", { role: null, "aria-live": null }],
        ["no-results", { role: "status", "aria-live": "polite" }],
    ] as const)("%s: un spread no cambia cómo se anuncia", (kind, expected) => {
        const { container } = render(<EmptyState {...injected} kind={kind} title="x" />)
        const el = container.firstElementChild!
        for (const [attr, value] of Object.entries(expected)) {
            if (value === null) expect(el).not.toHaveAttribute(attr)
            else expect(el).toHaveAttribute(attr, value)
        }
        expect(el).not.toHaveAttribute("aria-busy")
        expect(el).not.toHaveAttribute("aria-relevant")
        expect(el).toHaveAttribute("data-kind", kind)
    })
})

describe("Skeleton", () => {
    it("pulsa, salvo con «reducir movimiento»", () => {
        const { container } = render(<Skeleton className="h-4" />)
        expect(container.firstElementChild).toHaveClass("animate-pulse", "motion-reduce:animate-none", "h-4")
    })
})
