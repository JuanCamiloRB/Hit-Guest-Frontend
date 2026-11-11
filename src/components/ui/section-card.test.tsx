import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Card, CardDescription } from "./card"
import { SectionCard } from "./section-card"

const surfaceClasses = ["bg-card", "text-ink", "rounded-xl", "border", "border-rule", "shadow-sm"]

describe("SectionCard", () => {
    it("es una sección nombrada por su título (heading real) y muestra la descripción", () => {
        render(<SectionCard title="Clientes" description="Cuentas con acceso de soporte">contenido</SectionCard>)
        const section = screen.getByRole("region", { name: "Clientes" })
        expect(section.tagName).toBe("SECTION")
        const heading = screen.getByRole("heading", { name: "Clientes", level: 3 })
        expect(section).toHaveAttribute("aria-labelledby", heading.id)
        expect(screen.getByText("Cuentas con acceso de soporte")).toHaveClass("text-ink-2")
    })

    it("el nivel del título se ajusta a la página", () => {
        render(<SectionCard title="Importe" headingLevel={2}>x</SectionCard>)
        expect(screen.getByRole("heading", { name: "Importe", level: 2 })).toBeInTheDocument()
    })

    it("sin descripción, el encabezado lleva solo el título", () => {
        const { container } = render(<SectionCard title="Importe">x</SectionCard>)
        const header = container.querySelector("[data-slot=section-card] > div")!
        expect(header.querySelectorAll("p")).toHaveLength(0)
    })

    it("acciones: conservan su nombre, van DESPUÉS del título en el DOM y pueden bajar de línea", () => {
        render(
            <SectionCard
                title="Un título de sección bastante largo que en móvil ocuparía más de una línea"
                actions={<><button type="button">Actualizar</button><button type="button">Exportar CSV</button></>}
            >
                x
            </SectionCard>,
        )
        const heading = screen.getByRole("heading")
        const refresh = screen.getByRole("button", { name: "Actualizar" })
        expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeInTheDocument()
        // DOM = orden visual: el título antes que las acciones.
        expect(heading.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(refresh.parentElement).toHaveClass("flex-wrap", "min-w-0")
        // El título no se comprime ni desborda.
        expect(heading.parentElement).toHaveClass("min-w-0", "flex-1")
        expect(heading).toHaveClass("break-words")
    })

    it("sin el gap-6 ni el py-6 de Card: nada de espacio heredado entre encabezado y cuerpo", () => {
        const { container } = render(<SectionCard title="Clientes">x</SectionCard>)
        const section = container.querySelector("[data-slot=section-card]")!
        expect(section).toHaveClass("gap-0")
        expect(section).not.toHaveClass("gap-6")
        expect(section).not.toHaveClass("py-6")
    })

    it("cuerpo con padding por defecto; flush lo deja sin ninguno", () => {
        const { container, rerender } = render(<SectionCard title="Clientes"><span>dato</span></SectionCard>)
        const body = () => container.querySelector("[data-slot=section-card] > div:last-child")!
        expect(body()).toHaveClass("p-5")
        rerender(<SectionCard title="Clientes" flush><span>dato</span></SectionCard>)
        expect(body()).not.toHaveClass("p-5")
    })

    it("misma superficie que Card, con tokens", () => {
        const { container } = render(<><SectionCard title="A">x</SectionCard><Card>y</Card></>)
        const section = container.querySelector("[data-slot=section-card]")!
        const card = container.querySelector("[data-slot=card]")!
        for (const cls of surfaceClasses) {
            expect(section).toHaveClass(cls)
            expect(card).toHaveClass(cls)
        }
    })

    it("className sigue permitiendo una excepción justificada, y gana sobre la superficie", () => {
        const { container } = render(<SectionCard title="A" className="lg:col-span-2 shadow-none" data-testid="s">x</SectionCard>)
        const section = container.querySelector("[data-slot=section-card]")!
        expect(section).toHaveClass("lg:col-span-2", "shadow-none", "bg-card")
        expect(section).not.toHaveClass("shadow-sm")
        expect(screen.getByTestId("s")).toBe(section)
    })

    it("dos secciones en la misma página tienen títulos con ids distintos", () => {
        render(<><SectionCard title="Uno">x</SectionCard><SectionCard title="Dos">y</SectionCard></>)
        const [a, b] = screen.getAllByRole("region")
        expect(a.getAttribute("aria-labelledby")).not.toBe(b.getAttribute("aria-labelledby"))
        expect(screen.getByRole("region", { name: "Dos" })).toBe(b)
    })
})

describe("Card", () => {
    it("superficie neutral con tokens; la descripción usa ink-2 (contraste AA)", () => {
        render(<Card data-testid="c"><CardDescription>Detalle</CardDescription></Card>)
        const card = screen.getByTestId("c")
        for (const cls of surfaceClasses) expect(card).toHaveClass(cls)
        expect(card).not.toHaveClass("text-card-foreground")
        expect(screen.getByText("Detalle")).toHaveClass("text-ink-2")
    })
})

describe("Surface", () => {
    it("es la superficie de Card sin estructura, con la etiqueta pedida", async () => {
        const { Surface } = await import("./card")
        render(<Surface as="article" data-testid="s" className="p-5">x</Surface>)
        const el = screen.getByTestId("s")
        expect(el.tagName).toBe("ARTICLE")
        expect(el).toHaveClass("bg-card", "border-rule", "rounded-xl", "shadow-sm", "p-5")
    })

    it("flat quita la sombra; floating es la superficie de un panel flotante", async () => {
        const { Surface } = await import("./card")
        render(<><Surface flat data-testid="f" /><Surface floating data-testid="p" /></>)
        expect(screen.getByTestId("f")).toHaveClass("shadow-none")
        expect(screen.getByTestId("f")).not.toHaveClass("shadow-sm")
        expect(screen.getByTestId("p")).toHaveClass("rounded-md", "shadow-md")
        expect(screen.getByTestId("p")).not.toHaveClass("rounded-xl")
    })
})
