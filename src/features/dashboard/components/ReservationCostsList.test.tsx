import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { CostLineItem, ReservationCost, ReservationCostFailure } from "@/features/billing/types"
import { COST_CATEGORIES } from "@/features/billing/lib/pricing"
import { PAGE_SIZE, ReservationCostsList } from "./ReservationCostsList"

function cost(n: number): ReservationCost {
    return {
        reservationId: `r-${n}`,
        guestName: `Huésped ${n}`,
        unitName: "101",
        propertyName: "Pullman",
        checkIn: new Date(2026, 10, 1),
        lineItems: [],
        total: n,
        nodeRuns: [],
    }
}

function failure(n: number): ReservationCostFailure {
    return { reservationId: `f-${n}`, guestName: `Fallida ${n}`, unitName: "102", propertyName: "Pullman", checkIn: new Date(2026, 10, 1) }
}

const dataRows = () => screen.getAllByRole("row").length - 1 // sin el encabezado
const many = (n: number) => Array.from({ length: n }, (_, i) => cost(i + 1))

describe("ReservationCostsList — paginada: la tarjeta mide siempre lo mismo", () => {
    it("pinta una página, dice cuántas hay y avanza con Siguiente", () => {
        render(<ReservationCostsList costs={many(PAGE_SIZE + 5)} isLoading={false} />)

        expect(dataRows()).toBe(PAGE_SIZE)
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled()

        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(dataRows()).toBe(5)
        expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled()
    })

    it("con una sola página no muestra el control", () => {
        render(<ReservationCostsList costs={many(3)} isLoading={false} />)
        expect(screen.queryByText(/Página 1 de/)).toBeNull()
        expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull()
    })

    it("una búsqueda nueva vuelve a la primera página y recorta las páginas", () => {
        render(<ReservationCostsList costs={many(PAGE_SIZE * 2 + 1)} isLoading={false} />)
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(screen.getByText("Página 3 de 3")).toBeInTheDocument()

        fireEvent.change(screen.getByRole("textbox", { name: "Buscar en el consumo por reserva" }), { target: { value: "Huésped 1" } })
        // «Huésped 1», «Huésped 10»…«Huésped 19»: 11 filas, una sola página.
        expect(dataRows()).toBe(11)
        expect(screen.queryByText(/Página/)).toBeNull()
    })

    it("las reservas sin consumo van primero y entran en la misma paginación", () => {
        render(<ReservationCostsList costs={many(PAGE_SIZE)} failedReservations={[failure(1)]} isLoading={false} />)
        expect(dataRows()).toBe(PAGE_SIZE)
        expect(screen.getAllByRole("row")[1]).toHaveTextContent("Fallida 1")
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
    })
})

describe("ReservationCostsList — carga inicial progresiva", () => {
    it("sin nada todavía, el estado de carga de siempre", () => {
        render(<ReservationCostsList costs={[]} isLoading loadingProgress={{ done: 0, total: 10 }} />)
        expect(screen.getByText("Cargando consumo por reserva")).toBeInTheDocument()
    })

    it("con filas que ya llegaron, las pinta y dice cuántas van", () => {
        render(<ReservationCostsList costs={[cost(1), cost(2)]} isLoading loadingProgress={{ done: 3, total: 10 }} />)
        expect(dataRows()).toBe(2)
        expect(screen.getByRole("status")).toHaveTextContent("Cargando el consumo · 3 de 10 reservas")
        expect(screen.queryByText("Cargando consumo por reserva")).toBeNull()
    })

    it("mientras carga, las páginas aparecen a medida que hay filas y el avance sigue a la vista", () => {
        render(<ReservationCostsList costs={many(PAGE_SIZE + 3)} isLoading loadingProgress={{ done: 30, total: 60 }} />)
        expect(dataRows()).toBe(PAGE_SIZE)
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
        expect(screen.getByRole("status")).toHaveTextContent("30 de 60")
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }))
        expect(dataRows()).toBe(3)
    })
})

describe("ReservationCostsList — jerarquía: quién costó y cuánto", () => {
    const item = (category: (typeof COST_CATEGORIES)[number]["key"], over: Partial<CostLineItem> = {}): CostLineItem => ({
        category, label: category, amount: 0, count: 0, freeCount: 0, consumed: false, ...over,
    })
    const withItems = (n: number, items: Partial<Record<(typeof COST_CATEGORIES)[number]["key"], Partial<CostLineItem>>>): ReservationCost => ({
        ...cost(n),
        lineItems: COST_CATEGORIES.map((c) => item(c.key, items[c.key])),
    })
    const names = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getByRole("link").textContent)

    it("cargado: las que facturaron primero, de mayor a menor; durante la carga, el orden de llegada", () => {
        const costs = [{ ...cost(1), total: 0 }, { ...cost(2), total: 0.06 }, { ...cost(3), total: 0.75 }]
        const { rerender } = render(<ReservationCostsList costs={costs} isLoading loadingProgress={{ done: 3, total: 9 }} />)
        expect(names()).toEqual(["Huésped 1", "Huésped 2", "Huésped 3"])
        rerender(<ReservationCostsList costs={costs} isLoading={false} />)
        expect(names()).toEqual(["Huésped 3", "Huésped 2", "Huésped 1"])
    })

    it("«Solo con consumo (N)» filtra y se marca presionado; sin coincidencias, Limpiar filtros", () => {
        render(<ReservationCostsList costs={[{ ...cost(1), total: 0 }, { ...cost(2), total: 0.06 }]} isLoading={false} />)
        const chip = screen.getByRole("button", { name: "Solo con consumo (1)" })
        expect(chip).toHaveAttribute("aria-pressed", "false")
        fireEvent.click(chip)
        expect(chip).toHaveAttribute("aria-pressed", "true")
        expect(names()).toEqual(["Huésped 2"])

        fireEvent.change(screen.getByRole("textbox", { name: "Buscar en el consumo por reserva" }), { target: { value: "nadie" } })
        const empty = screen.getByText("Ninguna reserva coincide con la búsqueda").closest("[data-slot=empty-state]")
        expect(empty).toHaveAttribute("data-kind", "no-results")
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }))
        expect(names()).toEqual(["Huésped 2", "Huésped 1"])
        expect(chip).toHaveAttribute("aria-pressed", "false")
    })

    it("sin reservas facturadas no ofrece el filtro", () => {
        render(<ReservationCostsList costs={[{ ...cost(1), total: 0 }]} isLoading={false} />)
        expect(screen.queryByRole("button", { name: /Solo con consumo/ })).toBeNull()
    })

    it("si no corrió ningún nodo, una sola leyenda en vez de una fila de guiones", () => {
        render(<ReservationCostsList costs={[{ ...withItems(1, {}), total: 0 }]} isLoading={false} />)
        const row = screen.getAllByRole("row")[1]
        expect(within(row).getByText("Sin ejecuciones facturables")).toHaveAttribute("colspan", String(COST_CATEGORIES.length))
        expect(within(row).queryByText("—")).toBeNull()
    })

    it("con algún nodo, cada celda dice su estado: monto, «Sin cargo» o «No se ejecutó» para el lector", () => {
        render(<ReservationCostsList
            costs={[{ ...withItems(1, { checkin: { freeCount: 1 }, contract: { consumed: true, amount: 0.06, count: 1 } }), total: 0.06 }]}
            isLoading={false}
        />)
        const row = screen.getAllByRole("row")[1]
        expect(within(row).getByText("Sin cargo").closest("[data-slot=status-pill]")).toHaveAttribute("data-tone", "success")
        expect(within(row).getAllByText("0,06 USD")[0]).toHaveClass("text-ink")
        expect(within(row).getAllByText("No se ejecutó")).toHaveLength(COST_CATEGORIES.length - 2)
    })

    it("la que facturó lleva el acento de marca y el total en navy; la de cero, apagada", () => {
        render(<ReservationCostsList costs={[{ ...cost(1), total: 0 }, { ...cost(2), total: 0.75 }]} isLoading={false} />)
        const [billed, zero] = screen.getAllByRole("row").slice(1)
        expect(within(billed).getAllByRole("cell")[0].className).toMatch(/inset_3px_0_0_var\(--color-brand-purple\)/)
        expect(within(billed).getByText("0,75 USD")).toHaveClass("font-bold", "text-brand-navy")
        expect(within(zero).getByText("0,00 USD")).toHaveClass("text-ink-3")
        expect(within(zero).getAllByRole("cell")[0].className).not.toMatch(/brand-purple/)
    })

    it("el huésped lleva a su reserva y debajo va el alojamiento con el check-in", () => {
        render(<ReservationCostsList costs={[cost(1)]} isLoading={false} />)
        expect(screen.getByRole("link", { name: "Huésped 1" })).toHaveAttribute("href", "/dashboard/reservations/r-1")
        const link = screen.getByRole("link", { name: "Huésped 1" })
        expect(link.nextElementSibling).toHaveTextContent("101 · check-in 1 nov 2026")
    })
})
