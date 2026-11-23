import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

const mocks = vi.hoisted(() => ({ bffFetch: vi.fn(), small: false }))
vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))
const followed: string[] = []
const modifiers: { metaKey: boolean; ctrlKey: boolean }[] = []
// El enlace de la fila recibe un `click` real (con los modificadores del original):
// se registra y se cancela para que jsdom no intente navegar.
document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null
    if (!anchor) return
    followed.push(anchor.getAttribute("href") ?? "")
    modifiers.push({ metaKey: event.metaKey, ctrlKey: event.ctrlKey })
    event.preventDefault()
})
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

/** Las filas del cuerpo. */
const bodyRows = (table: HTMLElement = screen.getByRole("table")) => within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row")
/** Columnas: 0 Alojamiento, 1 Propiedad, 2 Conexión, 3 Estado, 4 Capacidad, 5 Precio. */
const cellOf = (row: HTMLElement, index: number) => within(row).getAllByRole("cell")[index]
/** El nombre accesible de la celda de dato (la cifra sola no dice qué es). */
const tileName = (row: HTMLElement, index: number) => within(cellOf(row, index)).getByRole("button").getAttribute("aria-label")

describe("PropertiesList — Alojamientos paginados", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.small = false
        followed.length = 0
        modifiers.length = 0
        resetPropertiesCaches()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("la propiedad lleva a su ficha con el edificio en primary", async () => {
        await openListings()
        const first = bodyRows()[0]
        const link = within(cellOf(first, 1)).getByRole("link", { name: "Pullman Miami" })
        expect(link).toHaveAttribute("href", "/dashboard/properties/p1")
        expect(link.querySelector(".lucide-building-2, .lucide-building2")).toHaveClass("text-primary")
        // Abrir la propiedad no es abrir el alojamiento: el clic no sigue también el enlace de la fila.
        await userEvent.setup().click(link)
        expect(followed).toEqual(["/dashboard/properties/p1"])
    })

    it("diseño 2026-11-24: tabla cómoda, encabezado de identidad y de precio en morado, capacidad con el ícono al lado, «Siguiente» resaltado", async () => {
        await openListings()
        const table = screen.getByRole("table")
        const head = (name: RegExp) => within(table).getByRole("columnheader", { name })
        expect(head(/Alojamiento/)).toHaveClass("bg-table-head-accent", "text-primary-hover", "h-11", "@5xl:px-4")
        expect(head(/Precio por noche/)).toHaveClass("bg-table-head-soft", "text-primary-hover", "text-right")
        expect(head(/Estado/)).not.toHaveClass("bg-table-head-accent", "bg-table-head-soft")
        expect(head(/Capacidad/).querySelector('[data-slot="column-header"]')).toHaveAttribute("data-layout", "inline")
        expect(cellOf(bodyRows()[0], 0)).toHaveClass("h-14", "@5xl:px-4")
        // Columnas de texto: 192 px en una tabla angosta (1280 px de ventana), 224 px desde 1024 px de tabla.
        expect(cellOf(bodyRows()[0], 0).querySelector('[data-slot="identity-cell"]')).toHaveClass("max-w-48", "@5xl:max-w-56")
        expect(screen.getByRole("link", { name: "Alojamiento 01" })).toHaveClass("font-semibold", "group-hover/row:text-primary-hover")
        expect(screen.getByRole("button", { name: /Siguiente/ })).toHaveClass("border-primary", "ring-primary/10")
    })

    it("precio en el chip de dato (se llena al pasar por la fila); conexión y «Sin vincular» en chips", async () => {
        const data = portfolio(3)
        Object.assign(data.listings.find((l) => l.name === "Alojamiento 01")!, { pmsIdentifiers: [{ id: 1, sourcePmsId: 134, sourcePms: "KunasPMS", externalId: "26118" }] })
        Object.assign(data.listings.find((l) => l.name === "Alojamiento 02")!, { pmsIdentifiers: [] })
        mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: data.properties } : data))
        render(<PropertiesList />)
        await screen.findByText("Pullman Miami")
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        const table = await screen.findByRole("table")
        await act(async () => {})
        const rows = bodyRows(table)
        const price = cellOf(rows[0], 5).querySelector('[data-slot="badge"]')!
        expect(price).toHaveAttribute("data-tone", "data")
        expect(price).toHaveTextContent("850.000")
        expect(price).toHaveClass("tabular-nums", "group-hover/row:bg-primary-hover")
        // Sin precio: el guion, sin chip.
        expect(cellOf(rows[2], 5).querySelector('[data-slot="badge"]')).toBeNull()
        expect(cellOf(rows[2], 5)).toHaveTextContent("—")
        expect(cellOf(rows[0], 2).querySelector('[data-slot="badge"]')).toHaveAttribute("data-tone", "integration")
        const unlinked = within(cellOf(rows[1], 2)).getByText("Sin vincular")
        expect(unlinked).toHaveAttribute("data-slot", "badge")
        expect(unlinked).toHaveAttribute("data-tone", "neutral")
    })

    it("10 por página, ordenados por nombre, con conteo y rango; la fila lleva a la pestaña Alojamientos de su propiedad", async () => {
        await openListings()
        expect(screen.getByText("28 alojamientos")).toHaveAttribute("role", "status")
        const rows = bodyRows()
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
        const rows = bodyRows()
        expect(tileName(rows[0], 4)).toBe("Capacidad: Hasta 4 huéspedes, habitaciones sin declarar, baños sin declarar")
        expect(rows[0]).toHaveTextContent("850.000")
        expect(rows[1]).toHaveTextContent("US$")
        expect(rows[1]).toHaveTextContent("150")
        // Sin conexión informada y sin precio: «—»; sin capacidad, la celda punteada «sin declarar».
        expect(within(rows[2]).getAllByText("—")).toHaveLength(2)
        expect(tileName(rows[2], 4)).toBe("Capacidad: sin declarar")
        expect(screen.queryByText(/\$\s?0\b/)).toBeNull()
        expect(screen.queryByRole("button", { name: /Hasta 2 huéspedes/ })).toBeNull()
    })

    it("conexión: logo y nombre de cada origen vinculado; «Sin vincular» si la respuesta afirma que no hay; «—» si no lo dice", async () => {
        const data = portfolio(3)
        const byName = (n: string) => data.listings.find((l) => l.name === n)!
        Object.assign(byName("Alojamiento 01"), { pmsIdentifiers: [
            { id: 1, sourcePmsId: 134, sourcePms: "KunasPMS", externalId: "26118" },
            { id: 2, sourcePmsId: 100, sourcePms: "Airbnb", externalId: "999" },
        ] })
        Object.assign(byName("Alojamiento 02"), { pmsIdentifiers: [] })
        mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: data.properties } : data))
        render(<PropertiesList />)
        await screen.findByText("Pullman Miami")
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        const table = await screen.findByRole("table")
        await act(async () => {})
        expect(within(table).getByRole("columnheader", { name: /Conexión/ })).toBeInTheDocument()
        const connection = (i: number) => cellOf(bodyRows(table)[i], 2)
        expect(connection(0)).toHaveTextContent("KunasPMS")
        expect(connection(0)).toHaveTextContent("Airbnb")
        // Airbnb con su logo de marca; KunasPMS (sin asset aprobado) con la marca neutra.
        expect(connection(0).querySelectorAll("svg")).toHaveLength(2)
        expect(connection(1)).toHaveTextContent("Sin vincular")
        expect(connection(2)).toHaveTextContent("—")
        // El id externo va en el detalle de la conexión, como el de cualquier celda.
        fireEvent.click(within(connection(0)).getByRole("button", { name: /KunasPMS/ }))
        await act(async () => {})
        expect(await screen.findByText("ID en KunasPMS: 26118")).toBeInTheDocument()
    })

    it("ordenar por conexión: el primer clic va de A a Z aunque la primera fila no la informe; «Sin vincular» por su texto y los «—» al final", async () => {
        const data = portfolio(5)
        const byName = (n: string) => data.listings.find((l) => l.name === n)!
        Object.assign(byName("Alojamiento 01"), { pmsIdentifiers: [{ id: 1, sourcePmsId: 134, sourcePms: "KunasPMS", externalId: "1" }] })
        Object.assign(byName("Alojamiento 02"), { pmsIdentifiers: [] })
        Object.assign(byName("Alojamiento 03"), { pmsIdentifiers: [{ id: 2, sourcePmsId: 100, sourcePms: "Airbnb", externalId: "2" }] })
        // La primera fila que llega (Alojamiento 05, por el orden inverso) no trae la clave.
        mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: data.properties } : data))
        render(<PropertiesList />)
        await screen.findByText("Pullman Miami")
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        const table = await screen.findByRole("table")
        await act(async () => {})
        fireEvent.click(within(table).getByRole("button", { name: /Conexión/ }))
        await act(async () => {})
        const cells = bodyRows(table).map((r) => cellOf(r, 2).textContent)
        expect(cells).toEqual(["Airbnb", "KunasPMS", "Sin vincular", "—", "—"])
    })

    it("capacidad: UNA columna con la celda de dato (ícono + huéspedes) y en el detalle huéspedes, habitaciones y baños; lo no declarado, punteado", async () => {
        const data = portfolio(2)
        Object.assign(data.listings.find((l) => l.name === "Alojamiento 01")!, { extra: { maxOccupancy: 6, bedRoom: 3 } })
        mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: data.properties } : data))
        render(<PropertiesList />)
        await screen.findByText("Pullman Miami")
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        const table = await screen.findByRole("table")
        await act(async () => {})
        // Una sola columna y una sola fila de encabezado (ya no agrupa tres).
        expect(within(table).getByRole("columnheader", { name: "Capacidad" })).toHaveAttribute("colspan", "1")
        expect(within(table).queryByRole("columnheader", { name: /Habitaciones|Baños/ })).toBeNull()
        expect(within(within(table).getAllByRole("rowgroup")[0]).getAllByRole("row")).toHaveLength(1)
        const [first, second] = bodyRows(table)
        const capacity = within(cellOf(first, 4)).getByRole("button", { name: "Capacidad: Hasta 6 huéspedes, 3 habitaciones o camas, baños sin declarar" })
        expect(capacity).toHaveAttribute("data-tone", "data")
        expect(capacity).toHaveTextContent(/^6$/)
        // Ninguna celda usa `title`: el detalle va en el Toggletip.
        expect(table.querySelector("td [title]")).toBeNull()
        fireEvent.click(capacity)
        await act(async () => {})
        expect(await screen.findByText("Capacidad · Alojamiento 01")).toBeInTheDocument()
        expect(screen.getByText("Hasta 6 huéspedes", { selector: "span" })).toBeInTheDocument()
        expect(screen.getByText("3 habitaciones o camas", { selector: "span" })).toBeInTheDocument()
        expect(screen.getByText("Baños: sin declarar")).toBeInTheDocument()
        // El segundo no declara nada: una celda punteada y deshabilitada, sin cifras inventadas.
        expect(tileName(second, 4)).toBe("Capacidad: sin declarar")
        expect(within(cellOf(second, 4)).getByRole("button")).toBeDisabled()
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
        expect(bodyRows()).toHaveLength(10)

        await user.click(screen.getByRole("button", { name: "Limpiar filtros aplicados" }))
        expect(screen.getByText("28 alojamientos")).toBeInTheDocument()
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument()
    })

    it("ordenar por capacidad (huéspedes) o precio deja lo no declarado al final en los dos sentidos", async () => {
        await openListings(12)
        const table = screen.getByRole("table")
        const guests = () => bodyRows(table).map((r) => tileName(r, 4))
        const FOUR = "Capacidad: Hasta 4 huéspedes, habitaciones sin declarar, baños sin declarar"
        fireEvent.click(within(within(table).getAllByRole("rowgroup")[0]).getByRole("button", { name: /Capacidad/ }))
        await act(async () => {})
        expect(guests()[0]).toBe(FOUR)
        expect(guests().slice(1).every((c) => c === "Capacidad: sin declarar")).toBe(true)
        fireEvent.click(within(within(table).getAllByRole("rowgroup")[0]).getByRole("button", { name: /Capacidad/ }))
        await act(async () => {})
        expect(guests()[0]).toBe(FOUR)
        expect(guests().slice(1).every((c) => c === "Capacidad: sin declarar")).toBe(true)

        const priceCells = () => bodyRows(table).map((r) => cellOf(r, 5).textContent)
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
        await screen.findAllByRole("list")
        await act(async () => {})
        // Las filas apiladas; dentro, cada una lleva su lista de capacidad.
        const items = [...document.querySelectorAll<HTMLElement>('[data-slot="data-table-mobile-row"]')]
        expect(items).toHaveLength(10)
        expect(items[0]).toHaveTextContent("Alojamiento 01")
        expect(items[0]).toHaveTextContent("Activo")
        expect(items[0]).toHaveTextContent("N-1")
        expect(items[0]).toHaveTextContent("Pullman Miami")
        expect(within(items[0]).getByRole("button", { name: /^Capacidad: Hasta 4 huéspedes/ })).toBeInTheDocument()
        // Sin encabezados en móvil: la celda lleva su nombre debajo, como en Operaciones.
        expect(within(within(items[0]).getByRole("list", { name: "Capacidad" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["4Capacidad"])
        expect(items[0]).toHaveTextContent("850.000")
        expect(screen.queryByRole("table")).toBeNull()
        expect(screen.getByText("Mostrando 1–10 de 28 alojamientos")).toBeInTheDocument()
    })
})

describe("PropertiesList — orden por nombre fijo (no el muestreo de TanStack)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.small = false
        resetPropertiesCaches()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("con 5 filas (≤10) ordena como un diccionario: acentos y mayúsculas no cuentan, los números van por valor", async () => {
        const names = ["Zebra", "Álamo", "casa 10", "casa 2", "Casa 3"]
        const data = {
            properties: [property("p1", "Pullman Miami")],
            listings: names.map((name, i) => ({ ...listing(i + 1, "p1"), name })),
            automationsByProperty: {},
        }
        mocks.bffFetch.mockImplementation((path: string) => Promise.resolve(path === LIGHT ? { data: data.properties } : data))
        render(<PropertiesList />)
        await screen.findByText("Pullman Miami")
        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        await screen.findByRole("table")
        await act(async () => {})
        const first = () => bodyRows().map((r) => cellOf(r, 0).textContent?.replace(/N-\d+$/, ""))
        expect(first()).toEqual(["Álamo", "casa 2", "Casa 3", "casa 10", "Zebra"])
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: /Alojamiento/ }))
        await act(async () => {})
        expect(first()).toEqual(["Zebra", "casa 10", "Casa 3", "casa 2", "Álamo"])
    })
})
