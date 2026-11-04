import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ReservationCost, ReservationCostFailure } from "@/features/billing/types"
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
