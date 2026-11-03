import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ConsumptionStatus } from "@/features/billing/hooks/useBillingData"
import type { ConsumptionSummary, ReservationCost, ReservationCostFailure } from "@/features/billing/types"

const mocks = vi.hoisted(() => ({
    billing: null as unknown as Record<string, unknown>,
    retry: vi.fn(),
    getBalance: vi.fn(),
}))

vi.mock("@/features/billing/hooks/useBillingData", () => ({ useBillingData: () => mocks.billing }))
vi.mock("@/features/billing/services/billing-service", () => ({ billingService: { getBalance: mocks.getBalance } }))
vi.mock("@/features/billing/components/RechargeDialog", () => ({ RechargeDialog: () => null }))
vi.mock("./MonthSelector", () => ({ MonthSelector: () => null }))

import { useBalanceStore } from "@/features/billing/hooks/useBalanceStore"
import { BalanceWidget } from "@/features/billing/components/BalanceWidget"
import { BillingDashboard } from "./BillingDashboard"

const SUMMARY: ConsumptionSummary = {
    monthTotal: 4,
    prevMonthTotal: 0,
    monthDeltaPct: null,
    lifetime: { processedReservations: 2, avgPerReservation: 2, avgTrend: null },
    verifiedGuests: 2,
    grandTotal: 4,
}

const COST: ReservationCost = {
    reservationId: "r-ok",
    guestName: "Ana Gómez",
    unitName: "101",
    propertyName: "Pullman",
    checkIn: new Date(),
    lineItems: [],
    total: 4,
    nodeRuns: [],
}

const failure = (id: string, guestName: string): ReservationCostFailure => ({
    reservationId: id, guestName, unitName: "102", propertyName: "Pullman", checkIn: new Date(),
})

function billing(status: ConsumptionStatus, extra: Record<string, unknown> = {}) {
    const hasData = status !== "loading" && status !== "error" && status !== "syncing"
    mocks.billing = {
        status,
        costs: hasData ? [COST] : [],
        failedReservations: [],
        refreshFailed: false,
        syncing: status === "syncing",
        summary: hasData ? SUMMARY : null,
        monthly: [],
        topNodes: [],
        refMonth: new Date(),
        setRefMonth: vi.fn(),
        retry: mocks.retry,
        ...extra,
    }
}

describe("BillingDashboard — fase 1: estados del consumo", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useBalanceStore.setState({ amount: null, currency: "USD", pending: false, isLoading: false, loaded: false, error: false })
        mocks.getBalance.mockResolvedValue({ amount: 6.49, currency: "USD" })
    })

    it("error total: aviso rojo con Reintentar, cifras en «—» y ningún «sin consumo»", () => {
        billing("error")
        render(<BillingDashboard />)

        const alert = screen.getByRole("alert")
        expect(alert).toHaveTextContent("No pudimos cargar la información de consumo.")
        fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }))
        expect(mocks.retry).toHaveBeenCalledTimes(1)

        expect(screen.queryByText(/0,00 USD/)).toBeNull()
        expect(screen.queryByText(/Sin consumo registrado/)).toBeNull()
        expect(screen.queryByText(/Ninguna automatización se ejecutó/)).toBeNull()
        expect(screen.queryByText(/Todavía no hay reservas con consumo/)).toBeNull()
        expect(screen.getAllByText("Consumo no disponible")).toHaveLength(3)
    })

    it("parcial: aviso amarillo con la cuenta y la fila fallida sin montos", () => {
        billing("partial", { failedReservations: [failure("r-1", "Beto Ruiz"), failure("r-2", "Carla Díaz"), failure("r-3", "Dani Paz")] })
        render(<BillingDashboard />)

        expect(screen.getByText(/No pudimos consultar el consumo de 3 reservas\. Los totales mostrados pueden estar incompletos\./)).toBeInTheDocument()
        const row = screen.getByText("Beto Ruiz").closest("tr")!
        expect(row).toHaveTextContent("Consumo no disponible")
        expect(row).not.toHaveTextContent("USD")
        // La reserva consultada sigue con su total.
        expect(screen.getByText("Ana Gómez").closest("tr")).toHaveTextContent("4,00")
    })

    it("una sola reserva fallida se nombra en singular", () => {
        billing("partial", { failedReservations: [failure("r-1", "Beto Ruiz")] })
        render(<BillingDashboard />)
        expect(screen.getByText(/el consumo de 1 reserva\. /)).toBeInTheDocument()
    })

    it("actualizando: indicador discreto y los datos anteriores siguen a la vista", () => {
        billing("refreshing")
        render(<BillingDashboard />)
        expect(screen.getByText("Actualizando consumo…")).toBeInTheDocument()
        expect(screen.getByText("Ana Gómez")).toBeInTheDocument()
        expect(screen.queryByRole("alert")).toBeNull()
    })

    it("el aviso parcial permanece visible mientras actualiza", () => {
        billing("refreshing", { failedReservations: [failure("r-1", "Beto Ruiz")] })
        render(<BillingDashboard />)

        expect(screen.getByText("Actualizando consumo…")).toBeInTheDocument()
        expect(screen.getByText(/No pudimos consultar el consumo de 1 reserva/)).toBeInTheDocument()
    })

    it("un 202 muestra sincronización con reintento, no un error rojo", () => {
        billing("syncing")
        render(<BillingDashboard />)

        const message = screen.getByText(/Las reservas se están sincronizando/)
        expect(screen.queryByRole("alert")).toBeNull()
        fireEvent.click(within(message.closest("div")!).getByRole("button", { name: "Reintentar" }))
        expect(mocks.retry).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/0,00 USD/)).toBeNull()
    })

    it("una actualización fallida avisa que se muestran los últimos datos", () => {
        billing("ready", { refreshFailed: true })
        render(<BillingDashboard />)
        expect(screen.getByText(/No pudimos actualizar el consumo/)).toBeInTheDocument()
        expect(screen.getByText("Ana Gómez")).toBeInTheDocument()
    })
})

describe("BillingDashboard — el saldo es el mismo del header", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useBalanceStore.setState({ amount: null, currency: "USD", pending: false, isLoading: false, loaded: false, error: false })
        billing("ready")
    })

    it("tarjeta y header leen el mismo store y muestran el mismo valor", async () => {
        mocks.getBalance.mockResolvedValue({ amount: 6.49, currency: "USD" })
        render(<><BalanceWidget /><BillingDashboard /></>)

        const widget = await screen.findByRole("link", { name: "Ver saldo y recargar" })
        await waitFor(() => expect(widget).toHaveTextContent("6,49"))
        expect(screen.getAllByText(/^6,49$/).length).toBeGreaterThanOrEqual(1)
    })

    it("sin saldo disponible dice «Saldo no disponible» (nunca 0) y Reintentar vuelve a consultar", async () => {
        mocks.getBalance.mockRejectedValue(new Error("network down"))
        render(<BillingDashboard />)

        expect(await screen.findByText(/Saldo no disponible/)).toBeInTheDocument()
        expect(screen.queryByText(/^0,00$/)).toBeNull()
        const calls = mocks.getBalance.mock.calls.length

        mocks.getBalance.mockResolvedValue({ amount: 6.49, currency: "USD" })
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        await waitFor(() => expect(mocks.getBalance.mock.calls.length).toBe(calls + 1))
        expect(await screen.findByText("6,49")).toBeInTheDocument()
    })
})
