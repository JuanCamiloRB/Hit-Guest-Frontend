import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Property } from "@/types"

const mocks = vi.hoisted(() => ({ bffFetch: vi.fn() }))
vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))
// La tarjeta tiene su propia lógica (y sus tests); aquí solo importa qué recibe.
vi.mock("./PropertyCard", () => ({
    PropertyCard: ({ property, activeListings, onStatusChange }: {
        property: Property
        activeListings: number | null
        onStatusChange?: (uuid: string, status: "ACTIVE" | "INACTIVE") => void
    }) => (
        <div data-testid="card">
            <span>{property.name}</span>
            <span>{property.status}</span>
            <span data-testid={`count-${property.uuid}`}>{activeListings ?? "—"}</span>
            <button type="button" onClick={() => onStatusChange?.(property.uuid!, "INACTIVE")}>Desactivar {property.name}</button>
        </div>
    ),
}))

import { resetPropertiesCaches } from "../lib/properties-cache"
import { PropertiesList } from "./PropertiesList"

const LIGHT = "/api/bff/properties"
const AGGREGATE = "/api/bff/properties-with-listings"
const rawProperty = (uuid: string) => ({ uuid, name: `Propiedad ${uuid}`, statusRecordId: 6, extra: {} })
const aggregate = (activeUnits: number) => ({
    properties: [rawProperty("p1")],
    listings: Array.from({ length: activeUnits }, (_, i) => ({ uuid: `l${i}`, name: `Unidad ${i}`, _propertyUuid: "p1", statusRecordId: 6, extra: {} })),
    automationsByProperty: { p1: [] },
})

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => { resolve = res })
    return { promise, resolve }
}

// La carga inicial es un esqueleto con su anuncio (Fase 2.5), no un spinner.
const spinner = () => screen.queryByText("Cargando propiedades…")

describe("PropertiesList — sobre las cachés", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetPropertiesCaches()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("las tarjetas salen con el endpoint liviano sin esperar al agregado, que completa los conteos después", async () => {
        const slow = deferred<unknown>()
        mocks.bffFetch.mockImplementation((path: string) =>
            path === LIGHT ? Promise.resolve({ data: [rawProperty("p1")] }) : slow.promise)
        render(<PropertiesList />)

        expect(await screen.findByText("Propiedad p1")).toBeInTheDocument()
        expect(screen.getByTestId("count-p1")).toHaveTextContent("—")

        await act(async () => slow.resolve(aggregate(2)))
        await waitFor(() => expect(screen.getByTestId("count-p1")).toHaveTextContent("2"))
    })

    it("sin nada cargado y las dos cargas caídas: lo dice, con Reintentar (no «no se encontraron»)", async () => {
        mocks.bffFetch.mockRejectedValue(new Error("BFF error 503"))
        render(<PropertiesList />)

        const failure = (await screen.findByText("No pudimos cargar tus propiedades")).closest("[data-slot=feedback-banner]")
        expect(failure).toHaveAttribute("data-tone", "danger")
        expect(failure).toHaveAttribute("role", "alert")
        expect(screen.queryByText(/Todavía no tienes propiedades|Sin resultados/)).toBeNull()

        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [rawProperty("p1")] } : aggregate(1)))
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(await screen.findByText("Propiedad p1")).toBeInTheDocument()
    })

    it("la primera carga muestra el esqueleto con su anuncio", async () => {
        const slow = deferred<unknown>()
        mocks.bffFetch.mockImplementation(() => slow.promise)
        render(<PropertiesList />)
        expect(spinner()).toHaveAttribute("role", "status")
        await act(async () => slow.resolve({ data: [] }))
    })

    it("sin propiedades invita a añadir la primera; con búsqueda sin coincidencias, «Sin resultados» y Limpiar filtros", async () => {
        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [] } : { properties: [], listings: [], automationsByProperty: {} }))
        const first = render(<PropertiesList />)
        const empty = (await screen.findByText("Todavía no tienes propiedades")).closest("[data-slot=empty-state]")
        expect(empty).toHaveAttribute("data-kind", "empty")
        expect(screen.getByRole("link", { name: /Añadir propiedad/ })).toHaveAttribute("href", "/dashboard/properties/new")
        first.unmount()
        resetPropertiesCaches()

        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [rawProperty("p1")] } : aggregate(1)))
        render(<PropertiesList />)
        await screen.findByText("Propiedad p1")
        fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "zzz" } })
        const noResults = screen.getByText("Sin resultados para «zzz»").closest("[data-slot=empty-state]")
        expect(noResults).toHaveAttribute("data-kind", "no-results")
        expect(noResults).toHaveAttribute("role", "status")
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }))
        expect(screen.getByText("Propiedad p1")).toBeInTheDocument()
    })

    it("volver a la pantalla muestra las propiedades al instante, sin el spinner, y las refresca detrás", async () => {
        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [rawProperty("p1")] } : aggregate(1)))
        const first = render(<PropertiesList />)
        await screen.findByText("Propiedad p1")
        await waitFor(() => expect(screen.getByTestId("count-p1")).toHaveTextContent("1"))
        first.unmount()

        render(<PropertiesList />)
        expect(spinner()).toBeNull()
        expect(screen.getByText("Propiedad p1")).toBeInTheDocument()
        expect(screen.getByTestId("count-p1")).toHaveTextContent("1")
        // Lo cargado sigue a la vista y la relectura se anuncia, sin interrumpir.
        const indicator = document.querySelector("[data-slot=refresh-indicator]")!
        await waitFor(() => expect(indicator).toHaveTextContent("Actualizando propiedades…"))
        await waitFor(() => expect(mocks.bffFetch).toHaveBeenCalledTimes(4))
        await waitFor(() => expect(indicator).toBeEmptyDOMElement())
    })

    it("desactivar desde la tarjeta cambia en el acto y relee el portafolio (los alojamientos también cambian)", async () => {
        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [rawProperty("p1")] } : aggregate(2)))
        render(<PropertiesList />)
        await waitFor(() => expect(screen.getByTestId("count-p1")).toHaveTextContent("2"))
        const aggregateCalls = () => mocks.bffFetch.mock.calls.filter(([path]) => path === AGGREGATE).length
        expect(aggregateCalls()).toBe(1)

        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [rawProperty("p1")] } : aggregate(0)))
        fireEvent.click(screen.getByRole("button", { name: "Desactivar Propiedad p1" }))

        expect(screen.getByText("INACTIVE")).toBeInTheDocument()
        await waitFor(() => expect(screen.getByTestId("count-p1")).toHaveTextContent("0"))
        expect(aggregateCalls()).toBe(2)
    })

    it("si el liviano falla pero el agregado no, las tarjetas salen del agregado, sin pantalla de error", async () => {
        mocks.bffFetch.mockImplementation((path: string) =>
            path === LIGHT ? Promise.reject(new Error("BFF error 503")) : Promise.resolve(aggregate(1)))
        render(<PropertiesList />)

        expect(await screen.findByText("Propiedad p1")).toBeInTheDocument()
        expect(screen.queryByText("No pudimos cargar tus propiedades")).toBeNull()
    })

    it("Alojamientos: si el agregado falla lo dice, y Reintentar trae las filas", async () => {
        mocks.bffFetch.mockImplementation((path: string) =>
            path === LIGHT ? Promise.resolve({ data: [rawProperty("p1")] }) : Promise.reject(new Error("BFF error 503")))
        render(<PropertiesList />)
        await screen.findByText("Propiedad p1")

        fireEvent.mouseDown(screen.getByRole("tab", { name: /Alojamientos/ }), { button: 0 })
        expect(await screen.findByText("No pudimos cargar los alojamientos")).toBeInTheDocument()

        mocks.bffFetch.mockImplementation((path: string) =>
            Promise.resolve(path === LIGHT ? { data: [rawProperty("p1")] } : aggregate(2)))
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(await screen.findByText("Unidad 1")).toBeInTheDocument()
    })
})
