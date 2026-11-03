import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { format, startOfMonth, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import type { ReservationCost } from "@/features/billing/types"
import { ConsumptionHistoryChart } from "./ConsumptionHistoryChart"
import { ReservationCostsList } from "./ReservationCostsList"
import { TopNodesPanel } from "./TopNodesPanel"

/**
 * Fase 2 (semántica): cada panel declara su universo y su agrupación por
 * check-in, y el selector mueve monto, mes y variación juntos.
 */

const mocks = vi.hoisted(() => ({ list: vi.fn(), getReservationCosts: vi.fn(), getBalance: vi.fn() }))

vi.mock("@/features/reservations/services/reservations-service", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/reservations/services/reservations-service")>()),
    reservationsService: { list: mocks.list },
}))
vi.mock("@/features/billing/services/consumption-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/features/billing/services/consumption-service")>()
    return {
        ...actual,
        consumptionService: {
            getReservationCosts: mocks.getReservationCosts,
            analyze: actual.consumptionService.analyze.bind(actual.consumptionService),
        },
    }
})
vi.mock("@/features/billing/services/billing-service", () => ({ billingService: { getBalance: mocks.getBalance } }))
vi.mock("@/features/billing/components/RechargeDialog", () => ({ RechargeDialog: () => null }))

import { BillingDashboard } from "./BillingDashboard"

const nov = new Date(2026, 10, 1)
const label = (d: Date) => format(d, "MMMM 'de' yyyy", { locale: es })

function cost(id: string, checkIn: Date, total: number): ReservationCost {
    return { reservationId: id, guestName: `Huésped ${id}`, unitName: "101", propertyName: "Pullman", checkIn, lineItems: [], total, nodeRuns: [] }
}

describe("paneles — universo y agrupación explícitos", () => {
    it("el historial nombra el mes elegido y la agrupación por check-in", () => {
        render(<ConsumptionHistoryChart monthly={[]} refMonth={nov} isLoading={false} />)
        expect(screen.getByText("6 meses hasta noviembre de 2026 · agrupado por fecha de check-in, en USD")).toBeInTheDocument()
    })

    it("el ranking habla de reservas con check-in en el mes, no de ejecuciones del mes", () => {
        render(<TopNodesPanel topNodes={[{ name: "Check-in Link Delivery", runs: 3 }]} refMonth={nov} isLoading={false} />)
        expect(screen.getByText("Ejecuciones exitosas de reservas con check-in en noviembre de 2026, incluidas las no facturables")).toBeInTheDocument()
        // El nombre del nodo es el que manda el backend, sin mapeos.
        expect(screen.getByText("Check-in Link Delivery")).toBeInTheDocument()
    })

    it("la tabla declara que incluye reservas con y sin consumo, también en su estado vacío", () => {
        const { unmount } = render(<ReservationCostsList costs={[cost("a", nov, 0)]} isLoading={false} />)
        expect(screen.getByText("Desglose de las reservas cargadas, con o sin consumo facturado.")).toBeInTheDocument()
        // Una reserva en 0 USD SÍ es una fila de la tabla.
        expect(screen.getByText("Huésped a")).toBeInTheDocument()
        unmount()

        render(<ReservationCostsList costs={[]} isLoading={false} />)
        expect(screen.getByText("Todavía no hay reservas para mostrar")).toBeInTheDocument()
        expect(screen.queryByText(/reservas con consumo/i)).not.toBeInTheDocument()
    })
})

describe("selector de mes — monto, mes y variación cambian juntos", () => {
    it("al ir al mes anterior se recalcula todo contra SU mes anterior", async () => {
        const current = startOfMonth(new Date())
        const prev = subMonths(current, 1)
        const prevPrev = subMonths(current, 2)
        mocks.getBalance.mockResolvedValue({ amount: 10, currency: "USD" })
        mocks.list.mockResolvedValue([])
        mocks.getReservationCosts.mockResolvedValue({
            costs: [
                cost("a", prevPrev, 4),   // dos meses atrás: 4 USD
                cost("b", prev, 2),       // mes anterior: 2 USD
                cost("c", current, 3),                  // mes actual: 3 USD
            ],
            failedReservations: [],
        })

        render(<BillingDashboard />)
        const card = (await screen.findByText("CONSUMO DEL MES")).closest("[data-slot='card']") as HTMLElement

        // Mes actual: 3 USD, +50 % contra el anterior (2 USD).
        await waitFor(() => expect(within(card).getByText("3,00 USD")).toBeInTheDocument())
        expect(within(card).getByText(`Reservas con check-in en ${label(current)}`)).toBeInTheDocument()
        expect(within(card).getByText(/\+50 %/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }))

        // Mes anterior: 2 USD, −50 % contra SU anterior (4 USD).
        expect(within(card).getByText("2,00 USD")).toBeInTheDocument()
        expect(within(card).getByText(`Reservas con check-in en ${label(prev)}`)).toBeInTheDocument()
        expect(within(card).getByText(/−50 %/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }))

        // Dos meses atrás: sin consumo el mes previo → texto, no porcentaje.
        expect(within(card).getByText("4,00 USD")).toBeInTheDocument()
        expect(within(card).getByText(/^Sin consumo en .+ para comparar$/)).toBeInTheDocument()
        expect(within(card).queryByText(/%/)).not.toBeInTheDocument()

        // Las tarjetas históricas no llevan variación mensual.
        const facturado = (screen.getByText("RESERVAS CON CONSUMO FACTURADO").closest("[data-slot='card']")) as HTMLElement
        expect(within(facturado).queryByText(/%|vs /)).not.toBeInTheDocument()
    })
})
