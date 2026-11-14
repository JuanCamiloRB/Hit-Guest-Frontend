import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Mail } from "lucide-react"
import { Figure } from "./figure"
import { DefinitionItem } from "./definition-list"
import { Card, Surface } from "./card"

describe("Figure", () => {
    it("va en Gabarito, bold, dígitos tabulares y tracking apretado; lg e ink por omisión", () => {
        render(<Figure>1.250,00</Figure>)
        const figure = screen.getByText("1.250,00")
        expect(figure.tagName).toBe("SPAN")
        expect(figure).toHaveClass("font-sans", "font-bold", "tabular-nums", "tracking-tight", "text-2xl", "text-ink")
        expect(figure).toHaveAttribute("data-size", "lg")
    })

    it("absent es ink-4 (el «—»), danger/warning son estados, y un código abre el tracking", () => {
        render(
            <>
                <Figure as="p" size="xl" tone="absent">— USD</Figure>
                <Figure size="xl" tone="danger">0,00 USD</Figure>
                <Figure size="md" tone="warning">3</Figure>
                <Figure kind="code">4821</Figure>
            </>,
        )
        const absent = screen.getByText("— USD")
        expect(absent.tagName).toBe("P")
        expect(absent).toHaveClass("text-3xl", "text-ink-4")
        expect(screen.getByText("0,00 USD")).toHaveClass("text-danger")
        expect(screen.getByText("3")).toHaveClass("text-lg", "text-warning")
        const code = screen.getByText("4821")
        expect(code).toHaveClass("tracking-widest")
        expect(code).not.toHaveClass("tracking-tight")
    })
})

describe("DefinitionItem", () => {
    it("término y definición válidos dentro de un dl, con el ícono dentro del dt y la definición alineada", () => {
        render(
            <dl>
                <DefinitionItem icon={Mail} label="Correo" prominent hint="Verificado">
                    ana@ejemplo.com
                </DefinitionItem>
            </dl>,
        )
        const term = screen.getByText("Correo")
        expect(term.tagName).toBe("DT")
        expect(term.querySelector('[data-slot="icon"]')).toHaveAttribute("aria-hidden", "true")
        const value = screen.getByText("ana@ejemplo.com")
        expect(value.tagName).toBe("DD")
        expect(value).toHaveClass("pl-5.5", "text-base", "font-bold", "text-ink", "truncate")
        const hint = screen.getByText("Verificado")
        expect(hint.tagName).toBe("DD")
        expect(hint).toHaveClass("text-xs", "text-ink-3", "pl-5.5")
        // Solo dt y dd dentro del grupo: nada que rompa la lista para el lector.
        const group = term.parentElement!
        expect([...group.children].map((c) => c.tagName)).toEqual(["DT", "DD", "DD"])
    })

    it("sin ícono no sangra, y sin prominent la definición es texto normal para un enlace o una pastilla", () => {
        render(
            <dl>
                <DefinitionItem label="Teléfono"><a href="tel:+57">+57 300</a></DefinitionItem>
            </dl>,
        )
        const value = screen.getByRole("link").parentElement!
        expect(value.tagName).toBe("DD")
        expect(value).toHaveClass("text-sm", "text-ink")
        expect(value).not.toHaveClass("pl-5.5", "font-bold")
    })
})

describe("Surface y Card — variantes", () => {
    it("inverse pinta sobre primary con texto blanco; interactive toma el borde input-hover; dashed es el hueco punteado", () => {
        render(
            <>
                <Card tone="inverse" data-testid="inverse">A</Card>
                <Card interactive data-testid="interactive">B</Card>
                <Surface dashed data-testid="dashed">C</Surface>
                <Card data-testid="plain">D</Card>
            </>,
        )
        const inverse = screen.getByTestId("inverse")
        expect(inverse).toHaveClass("bg-primary", "text-white", "border-primary")
        expect(inverse).toHaveAttribute("data-tone", "inverse")
        expect(inverse).not.toHaveClass("bg-card")

        const interactive = screen.getByTestId("interactive")
        expect(interactive).toHaveClass("hover:border-input-hover", "group-hover:border-input-hover", "transition-colors")
        expect(interactive).toHaveAttribute("data-interactive", "true")

        const dashed = screen.getByTestId("dashed")
        expect(dashed).toHaveClass("border-2", "border-dashed", "bg-sunk/50", "shadow-none")
        expect(dashed).not.toHaveClass("shadow-sm")

        const plain = screen.getByTestId("plain")
        expect(plain).toHaveClass("bg-card", "border-rule", "shadow-sm", "rounded-xl")
        expect(plain).toHaveAttribute("data-tone", "default")
        expect(plain).not.toHaveAttribute("data-interactive")
    })

    it("warning y danger tiñen solo el borde (estado de tarjeta, no aviso); muted apaga la superficie sin opacidad", () => {
        render(
            <>
                <Surface tone="warning" data-testid="warning">A</Surface>
                <Surface tone="danger" data-testid="danger">B</Surface>
                <Surface tone="sunk" data-testid="sunk">C</Surface>
            </>,
        )
        render(<Surface tone="selected" data-testid="selected">S</Surface>)
        expect(screen.getByTestId("selected")).toHaveClass("border-primary/30", "bg-primary/5")
        expect(screen.getByTestId("warning")).toHaveClass("border-warning/30", "bg-card")
        expect(screen.getByTestId("danger")).toHaveClass("border-danger/30", "bg-card")
        const sunk = screen.getByTestId("sunk")
        expect(sunk).toHaveClass("bg-sunk/50", "shadow-none")
        expect(sunk.className).not.toMatch(/opacity-/)
    })

    it("una tarjeta elegida e interactiva refuerza su borde morado al pasar, no lo cambia por gris", () => {
        render(
            <>
                <Card interactive tone="selected" data-testid="active">A</Card>
                <Card interactive data-testid="plain">B</Card>
            </>,
        )
        const active = screen.getByTestId("active")
        expect(active).toHaveClass("border-primary/30", "hover:border-primary")
        expect(active).not.toHaveClass("hover:border-input-hover")
        expect(screen.getByTestId("plain")).toHaveClass("hover:border-input-hover")
    })

    it("Card dashed y SectionCard flat; la pantalla puede sumar layout pero no deshacer la superficie", () => {
        render(
            <>
                <Card dashed data-testid="dashed">A</Card>
                <Surface tone="sunk" className="p-4 shadow-sm" data-testid="layout">B</Surface>
            </>,
        )
        expect(screen.getByTestId("dashed")).toHaveClass("border-2", "border-dashed", "bg-sunk/50")
        // tailwind-merge: la última clase gana, por eso `className` es solo layout (la regla surface-override lo impide).
        const layout = screen.getByTestId("layout")
        expect(layout).toHaveClass("p-4", "bg-sunk/50")
    })
})
