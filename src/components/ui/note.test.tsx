import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Lock } from "lucide-react"
import { Note } from "./note"

describe("Note", () => {
    it("por omisión es un párrafo hundido, compacto, sin rol ni región viva", () => {
        render(<Note>Guarda la unidad para poder personalizar el texto.</Note>)
        const note = screen.getByText("Guarda la unidad para poder personalizar el texto.")
        expect(note.tagName).toBe("P")
        expect(note).toHaveClass("bg-sunk/50", "rounded-lg", "px-3", "py-2", "text-xs", "text-ink-2")
        expect(note).not.toHaveAttribute("role")
        expect(note).not.toHaveAttribute("aria-live")
        expect(note).toHaveAttribute("data-tone", "neutral")
    })

    it("accent es el tinte de lo destacado; default es un bloque sm; as=ul lista", () => {
        render(
            <>
                <Note tone="accent" density="default" as="div" data-testid="accent"><p>¿Viajas acompañado?</p></Note>
                <Note as="ul" data-testid="list"><li>Mira a la cámara</li></Note>
            </>,
        )
        const accent = screen.getByTestId("accent")
        expect(accent.tagName).toBe("DIV")
        expect(accent).toHaveClass("bg-primary/5", "border", "border-primary/20", "p-4", "text-sm")
        expect(accent).not.toHaveClass("bg-sunk/50")
        expect(screen.getByTestId("list").tagName).toBe("UL")
    })

    it("con ícono, el ícono es decorativo y toma la tinta del tono; el texto queda en su propio nodo", () => {
        render(<Note icon={Lock} tone="accent">Tus datos se cifran.</Note>)
        const text = screen.getByText("Tus datos se cifran.")
        expect(text.tagName).toBe("SPAN")
        const note = text.closest('[data-slot="note"]')!
        expect(note).toHaveClass("flex", "items-start", "gap-2")
        const glyph = note.querySelector('[data-slot="icon"]')!
        expect(glyph).toHaveAttribute("aria-hidden", "true")
        expect(glyph).toHaveClass("text-primary", "size-3.5")
        expect(note).toHaveTextContent("Tus datos se cifran.")
    })

    it("como bloque con ícono, el cuerpo es un div (admite párrafos) y el ícono es md; una lista va sin ícono", () => {
        render(
            <>
                <Note as="div" density="default" icon={Lock} data-testid="block"><p>Uno</p><p>Dos</p></Note>
                <Note as="li" data-testid="item">Elemento</Note>
            </>,
        )
        const block = screen.getByTestId("block")
        const body = screen.getByText("Uno").parentElement!
        expect(body.tagName).toBe("DIV")
        expect(body).toHaveClass("min-w-0", "flex-1")
        expect(block.querySelector('[data-slot="icon"]')).toHaveClass("size-4")
        expect(screen.getByTestId("item").tagName).toBe("LI")
        expect(screen.getByTestId("item").querySelector('[data-slot="icon"]')).toBeNull()
    })
})
