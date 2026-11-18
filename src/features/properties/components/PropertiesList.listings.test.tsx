import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

const mocks = vi.hoisted(() => ({ bffFetch: vi.fn(), small: false }))
vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))
const followed: string[] = []
vi.mock("@/hooks/useMediaQuery", () => ({ SMALL_SCREEN_QUERY: "(max-width: 767px)", useMediaQuery: () => mocks.small }))
vi.mock("./PropertyCard", () => ({ PropertyCard: ({ property }: { property: { name: string } }) => <div>{property.name}</div> }))

import { resetPropertiesCaches } from "../lib/properties-cache"
import { LISTINGS_PAGE_SIZE, PropertiesList } from "./PropertiesList"

const LIGHT = "/api/bff/properties"
const property = (uuid: string, name: string) => ({ uuid, name, statusRecordId: 6, extra: {} })
const listing = (i: number, propertyUuid: string, extra: Record<string, unknown> = {}, more: Record<string, unknown> = {}) => ({
    uuid: `l${i}`, name: `Alojamiento ${String(i).padStart(2, "0")}`, internalName: i % 2 ? `N-${i}` : "", _propertyUuid: propertyUuid, statusRecordId: i % 7 === 0 ? 7 : 6,
    extra, ...more,
})

function portfolio(count = 28) {
    return {
        properties: [property("p1", "Pullman Miami"), property("p2", "Nomad House")],
        // En orden inverso a propósito: el orden inicial por nombre lo pone la tabla, no el backend.
        listings: Array.from({ length: count }, (_, i) => listing(i + 1, i < 10 ? "p1" : "p2",
            i === 0 ? { maxOccupancy: 4, currency: "COP", startPrice: 850000 } : i === 1 ? { currency: "USD" } : {},
            i === 1 ? { price: 150 } : {})).reverse(),
        automationsByProperty: {},
    }
}

async function openListings(count = 28) {
    mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: portfolio(count).properties } : portfolio(count)))
    render(<PropertiesList />)
    await screen.findByText("Pullman Miami")
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
    await screen.findByRole("table")
    await act(async () => {})
}

describe("PropertiesList — Alojamientos paginados", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.small = false
        followed.length = 0
        resetPropertiesCaches()
        vi.spyOn(console, "error").mockImplementation(() => {})
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { followed.push(this.getAttribute("href") ?? "") })
    })

    it("10 por página, ordenados por nombre, con conteo y rango; la fila lleva a la pestaña Alojamientos de su propiedad", async () => {
        await openListings()
        expect(screen.getByText("28 alojamientos")).toHaveAttribute("role", "status")
        const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1)
        expect(rows).toHaveLength(LISTINGS_PAGE_SIZE)
        expect(rows[0]).toHaveTextContent("Alojamiento 01")
        expect(rows[9]).toHaveTextContent("Alojamiento 10")
        expect(screen.getByText("Mostrando 1–10 de 28 alojamientos")).toBeInTheDocument()
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Alojamiento 01" })).toHaveAttribute("href", "/dashboard/properties/p1?tab=units&unit=l1")
        // Número interno debajo del nombre; sin número, nada.
        expect(rows[0]).toHaveTextContent("N-1")
        expect(rows[1]).not.toHaveTextContent("N-")
        fireEvent.click(within(rows[2]).getAllByRole("cell")[1])
        expect(followed).toEqual(["/dashboard/properties/p1?tab=units&unit=l3"])
    })

    it("precio con su moneda; sin precio o sin capacidad, «—» (nunca «$0» ni «2 huéspedes» inventados)", async () => {
        await openListings()
        const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1)
        expect(rows[0]).toHaveTextContent("4 huéspedes")
        expect(rows[0]).toHaveTextContent("850.000")
        expect(rows[1]).toHaveTextContent("US$")
        expect(rows[1]).toHaveTextContent("150")
        expect(within(rows[2]).getAllByText("—")).toHaveLength(2)
        expect(screen.queryByText(/\$\s?0\b/)).toBeNull()
        expect(screen.queryByText("2 huéspedes")).toBeNull()
    })

    it("buscar por propiedad filtra, cuenta «N de 28», vuelve a la página 1 y «Limpiar filtros» aparece solo con filtro", async () => {
        const user = userEvent.setup()
        await openListings()
        expect(screen.queryByRole("button", { name: "Limpiar filtros aplicados" })).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument()

        await user.type(screen.getByRole("textbox", { name: "Buscar alojamientos" }), "Pullman")
        await act(async () => {})
        expect(screen.getByText("10 de 28 alojamientos")).toBeInTheDocument()
        expect(screen.queryByText(/Página/)).toBeNull()
        expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(10)

        await user.click(screen.getByRole("button", { name: "Limpiar filtros aplicados" }))
        expect(screen.getByText("28 alojamientos")).toBeInTheDocument()
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument()
    })

    it("ordenar por capacidad o precio deja los «—» al final en los dos sentidos", async () => {
        await openListings(12)
        const table = screen.getByRole("table")
        const firstCells = () => within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[3].textContent)
        fireEvent.click(within(table).getByRole("button", { name: /Capacidad/ }))
        await act(async () => {})
        expect(firstCells()[0]).toBe("4 huéspedes")
        expect(firstCells().slice(1).every((c) => c === "—")).toBe(true)
        fireEvent.click(within(table).getByRole("button", { name: /Capacidad/ }))
        await act(async () => {})
        expect(firstCells()[0]).toBe("4 huéspedes")
        expect(firstCells().slice(1).every((c) => c === "—")).toBe(true)

        const priceCells = () => within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[4].textContent)
        // Primer clic: de menor a mayor (como en las columnas de texto); los «—» al final.
        fireEvent.click(within(table).getByRole("button", { name: /Precio por noche/ }))
        await act(async () => {})
        expect(priceCells()[0]).toContain("150")
        expect(priceCells()[1]).toContain("850.000")
        expect(priceCells().slice(2).every((c) => c === "—")).toBe(true)
        // Segundo clic: de mayor a menor; los «—» siguen al final.
        fireEvent.click(within(table).getByRole("button", { name: /Precio por noche/ }))
        await act(async () => {})
        expect(priceCells()[0]).toContain("850.000")
        expect(priceCells()[1]).toContain("150")
        expect(priceCells().slice(2).every((c) => c === "—")).toBe(true)
    })

    it("el filtro de propiedad solo existe en la pestaña Alojamientos", async () => {
        await openListings()
        expect(screen.getByRole("combobox", { name: "Filtrar por propiedad" })).toBeInTheDocument()
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Propiedades/ }), { button: 0 })
        await screen.findByText("Pullman Miami")
        expect(screen.queryByRole("combobox", { name: "Filtrar por propiedad" })).toBeNull()
    })

    it("sin resultados: aviso con «Limpiar filtros» que restaura la lista", async () => {
        const user = userEvent.setup()
        await openListings()
        await user.type(screen.getByRole("textbox", { name: "Buscar alojamientos" }), "zzz")
        expect(await screen.findByText("Sin resultados para «zzz»")).toBeInTheDocument()
        expect(screen.getByText("0 de 28 alojamientos")).toBeInTheDocument()
        await user.click(within(screen.getByRole("table")).getByRole("button", { name: "Limpiar filtros" }))
        expect(screen.getByText("28 alojamientos")).toBeInTheDocument()
    })

    it("en móvil cada alojamiento es una fila apilada con nombre, estado, número, propiedad, capacidad y precio", async () => {
        mocks.small = true
        mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: portfolio().properties } : portfolio()))
        render(<PropertiesList />)
        await screen.findByText("Pullman Miami")
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        const list = await screen.findByRole("list")
        await act(async () => {})
        const items = within(list).getAllByRole("listitem")
        expect(items).toHaveLength(10)
        expect(items[0]).toHaveTextContent("Alojamiento 01")
        expect(items[0]).toHaveTextContent("Activo")
        expect(items[0]).toHaveTextContent("N-1")
        expect(items[0]).toHaveTextContent("Pullman Miami")
        expect(items[0]).toHaveTextContent("4 huéspedes")
        expect(items[0]).toHaveTextContent("850.000")
        expect(screen.queryByRole("table")).toBeNull()
        expect(screen.getByText("Mostrando 1–10 de 28 alojamientos")).toBeInTheDocument()
    })
})
