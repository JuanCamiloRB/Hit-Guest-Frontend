import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FileText } from "lucide-react"

import { StatusTile, StatusTileSkeleton } from "./status-tile"

describe("StatusTile", () => {
    it("es un botón con nombre accesible completo; por defecto type=button (no envía formularios)", () => {
        render(<form><StatusTile tone="success" icon={FileText} label="Contrato: firmado" /></form>)
        const tile = screen.getByRole("button", { name: "Contrato: firmado" })
        expect(tile).toHaveAttribute("type", "button")
        expect(tile).toHaveAttribute("data-slot", "status-tile")
        expect(tile).toHaveAttribute("data-tone", "success")
    })

    it("la marca de FORMA sigue al tono: ✓ hecho, reloj pendiente, ✕ falló; sin marca si todavía no corre", () => {
        const { rerender } = render(<StatusTile tone="success" icon={FileText} label="x" />)
        const glyph = () => screen.getByRole("button").querySelector('[data-slot="status-tile-glyph"] svg')
        expect(glyph()).toHaveClass("lucide-check")
        rerender(<StatusTile tone="warning" icon={FileText} label="x" />)
        expect(glyph()).toHaveClass("lucide-clock")
        rerender(<StatusTile tone="danger" icon={FileText} label="x" />)
        expect(glyph()).toHaveClass("lucide-x")
        rerender(<StatusTile tone="idle" icon={FileText} label="x" />)
        expect(glyph()).toBeNull()
        expect(screen.getByRole("button").querySelector(".lucide-file-text")).not.toBeNull()
    })

    it("none: solo el guion, borde punteado; sin el ícono ni el contador", () => {
        render(<StatusTile tone="none" icon={FileText} count="1/2" label="Contrato: no configurado" disabled />)
        const tile = screen.getByRole("button")
        expect(tile).toBeDisabled()
        expect(tile).toHaveClass("border-dashed")
        expect(tile.querySelector(".lucide-minus")).not.toBeNull()
        expect(tile.querySelector(".lucide-file-text")).toBeNull()
        expect(tile).not.toHaveTextContent("1/2")
    })

    it("contador y children en lugar del ícono (canales del link)", () => {
        render(<StatusTile tone="warning" count="1/2" label="Check-in: 1 de 2"><span data-testid="canal" /></StatusTile>)
        expect(screen.getByRole("button")).toHaveTextContent("1/2")
        expect(screen.getByTestId("canal")).toBeInTheDocument()
    })

    it("ancho y alto fijos para todas: la columna no cambia según el texto", () => {
        render(<><StatusTile tone="success" label="a" /><StatusTile tone="none" label="b" /></>)
        for (const tile of screen.getAllByRole("button")) expect(tile).toHaveClass("h-8", "w-16")
    })

    it("tonos con tokens del sistema, nunca colores sueltos", () => {
        const { rerender } = render(<StatusTile tone="success" label="x" />)
        expect(screen.getByRole("button")).toHaveClass("bg-success-sunk", "text-success")
        rerender(<StatusTile tone="warning" label="x" />)
        expect(screen.getByRole("button")).toHaveClass("bg-warning-sunk", "text-warning")
        rerender(<StatusTile tone="danger" label="x" />)
        expect(screen.getByRole("button")).toHaveClass("bg-danger-sunk", "text-danger")
        rerender(<StatusTile tone="idle" label="x" />)
        expect(screen.getByRole("button")).toHaveClass("bg-card", "text-ink-3")
    })

    it("onClick del consumidor llega; el nombre no se puede pisar desde props", async () => {
        const onClick = vi.fn()
        render(<StatusTile tone="success" label="Link: enviado" aria-label="otro" onClick={onClick} />)
        await userEvent.setup().click(screen.getByRole("button", { name: "Link: enviado" }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("esqueleto del mismo tamaño mientras carga, con texto para lectores", () => {
        render(<StatusTileSkeleton />)
        const sk = document.querySelector('[data-slot="status-tile-skeleton"]')!
        expect(sk).toHaveClass("h-8", "w-16")
        expect(sk).toHaveTextContent("Cargando estado")
    })
})
