import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Heading, headingVariants } from "./heading"
import { Page, PageBreadcrumb, PageHeader } from "./page"

describe("Heading", () => {
    it("el nivel decide la etiqueta y el tamaño por omisión", () => {
        render(
            <>
                <Heading level={1}>Uno</Heading>
                <Heading level={2}>Dos</Heading>
                <Heading level={3}>Tres</Heading>
                <Heading level={4}>Cuatro</Heading>
            </>
        )
        expect(screen.getByRole("heading", { level: 1, name: "Uno" })).toHaveAttribute("data-size", "page")
        expect(screen.getByRole("heading", { level: 2, name: "Dos" })).toHaveAttribute("data-size", "title")
        expect(screen.getByRole("heading", { level: 3, name: "Tres" })).toHaveAttribute("data-size", "section")
        expect(screen.getByRole("heading", { level: 4, name: "Cuatro" })).toHaveAttribute("data-size", "subsection")
    })

    it("nivel y tamaño son independientes: un h3 puede verse como rótulo de grupo", () => {
        render(<Heading level={3} size="group" tone="muted">Huésped</Heading>)
        const h = screen.getByRole("heading", { level: 3 })
        expect(h).toHaveClass("text-xs", "text-ink-3", "font-bold", "font-sans")
    })

    it("tinta por omisión, inverse sobre superficies oscuras", () => {
        render(<Heading level={2} tone="inverse">Acciones</Heading>)
        expect(screen.getByRole("heading")).toHaveClass("text-white")
        expect(headingVariants({ size: "page" })).toContain("text-ink")
    })

    it("la escala usa solo tamaños del manual (sin arbitrarios)", () => {
        for (const size of ["page", "title", "section", "subsection", "group"] as const) {
            expect(headingVariants({ size })).not.toMatch(/text-\[|font-(?:black|extrabold|light|thin)/)
        }
    })
})

describe("PageHeader", () => {
    it("pone el único h1 de la pantalla, con descripción y acciones", () => {
        render(<PageHeader title="Operaciones" description="Tus reservas" actions={<button>Nueva</button>} />)
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Operaciones")
        expect(screen.getByText("Tus reservas")).toHaveClass("text-ink-2")
        expect(screen.getByRole("button", { name: "Nueva" })).toBeInTheDocument()
    })
})

describe("PageBreadcrumb", () => {
    it("los pasos con href son enlaces; el último es la pantalla actual", () => {
        render(<PageBreadcrumb items={[{ label: "Reservas", href: "/dashboard/reservations" }, { label: "ABC-1" }]} />)
        expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/dashboard/reservations")
        expect(screen.getByText("ABC-1")).toHaveAttribute("aria-current", "page")
    })
})

describe("Page", () => {
    it("no trae relleno propio: el de <main> es el único", () => {
        render(<Page data-testid="p">x</Page>)
        expect(screen.getByTestId("p").className).not.toMatch(/(?<![\w-])p[xytblr]?-\d/)
    })
})
