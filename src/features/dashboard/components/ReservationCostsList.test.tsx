import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ReservationCost } from "@/features/billing/types"
import { ReservationCostsList, ROWS_PER_STEP } from "./ReservationCostsList"

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

const dataRows = () => screen.getAllByRole("row").length - 1 // sin el encabezado

describe("ReservationCostsList — la tabla no crece con la cuenta", () => {
    it("pinta el primer tramo y «Mostrar más» agrega el siguiente", () => {
        const costs = Array.from({ length: ROWS_PER_STEP + 5 }, (_, i) => cost(i + 1))
        render(<ReservationCostsList costs={costs} isLoading={false} />)

        expect(dataRows()).toBe(ROWS_PER_STEP)
        fireEvent.click(screen.getByRole("button", { name: "Mostrar más (5 restantes)" }))
        expect(dataRows()).toBe(ROWS_PER_STEP + 5)
        expect(screen.queryByRole("button", { name: /Mostrar más/ })).toBeNull()
    })

    it("una búsqueda nueva vuelve al primer tramo", () => {
        const costs = Array.from({ length: ROWS_PER_STEP * 2 + 1 }, (_, i) => cost(i + 1))
        render(<ReservationCostsList costs={costs} isLoading={false} />)
        fireEvent.click(screen.getByRole("button", { name: /Mostrar más/ }))
        expect(dataRows()).toBe(ROWS_PER_STEP * 2)

        fireEvent.change(screen.getByRole("textbox", { name: "Buscar en el consumo por reserva" }), { target: { value: "Huésped" } })
        expect(dataRows()).toBe(ROWS_PER_STEP)
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

    it("mientras carga, «Mostrar más» sigue disponible si ya hay más filas que el tramo", () => {
        const costs = Array.from({ length: ROWS_PER_STEP + 3 }, (_, i) => cost(i + 1))
        render(<ReservationCostsList costs={costs} isLoading loadingProgress={{ done: 30, total: 60 }} />)
        expect(dataRows()).toBe(ROWS_PER_STEP)
        fireEvent.click(screen.getByRole("button", { name: "Mostrar más (3 restantes)" }))
        expect(dataRows()).toBe(ROWS_PER_STEP + 3)
        expect(screen.getByRole("status")).toHaveTextContent("30 de 60")
    })
})
