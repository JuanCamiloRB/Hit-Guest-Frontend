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
vi.mock("./MonthSelector", () => ({ MonthSelector: () => <div data-testid="month-selector" /> }))

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

const activity = () => screen.getByRole("region", { name: "Actividad del mes" })

describe("BillingDashboard — fase 3: cada estado vive en el nivel que afecta", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useBalanceStore.setState({ amount: null, currency: "USD", pending: false, isLoading: false, loaded: false, error: false })
        mocks.getBalance.mockResolvedValue({ amount: 6.49, currency: "USD" })
    })

    it("tres niveles: saldo, actividad del mes (con el selector) e historial + detalle fuera de ella", () => {
        billing("ready")
        render(<BillingDashboard />)

        const balance = screen.getByRole("region", { name: "Saldo disponible" })
        const history = screen.getByRole("region", { name: "Desde el inicio de la cuenta" })
        const table = screen.getByText("Detalle por reserva")

        // El selector solo gobierna la actividad: saldo, histórico y tabla quedan fuera.
        expect(within(activity()).getByTestId("month-selector")).toBeInTheDocument()
        expect(activity()).not.toContainElement(balance)
        expect(activity()).not.toContainElement(history)
        expect(activity()).not.toContainElement(table)
        // Orden de lectura: cuenta → periodo → historial → detalle.
        expect(balance.compareDocumentPosition(activity()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(activity().compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(history.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        // Historial y nodos son parte del mismo análisis.
        expect(within(activity()).getByRole("heading", { name: "Historial" })).toBeInTheDocument()
        expect(within(activity()).getByRole("heading", { name: "Nodos ejecutados" })).toBeInTheDocument()
    })

    it("carga inicial: skeleton completo del nivel 2, sin cifras", () => {
        billing("loading")
        render(<BillingDashboard />)
        expect(within(activity()).getByRole("status", { name: "Cargando la actividad del mes" })).toBeInTheDocument()
        expect(within(activity()).queryByText(/USD/)).toBeNull()
    })

    it("refresh: los datos siguen a la vista con «Actualizando…»", () => {
        billing("refreshing")
        render(<BillingDashboard />)
        expect(within(activity()).getByText("Actualizando…")).toBeInTheDocument()
        expect(within(activity()).getByText("4,00 USD")).toBeInTheDocument()
        expect(screen.getByText("Ana Gómez")).toBeInTheDocument()
        expect(screen.queryByRole("alert")).toBeNull()
    })

    it("error sin datos: un único mensaje en lugar del análisis, con Reintentar y sin ceros", () => {
        billing("error")
        render(<BillingDashboard />)

        const alert = within(activity()).getByRole("alert")
        expect(alert).toHaveTextContent("No pudimos cargar la información de consumo.")
        fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }))
        expect(mocks.retry).toHaveBeenCalledTimes(1)

        expect(within(activity()).queryByRole("heading", { name: "Historial" })).toBeNull()
        expect(screen.queryByText(/0,00 USD/)).toBeNull()
        expect(screen.queryByText(/Sin consumo facturado/)).toBeNull()
        expect(screen.queryByText(/Ninguna automatización se ejecutó/)).toBeNull()
        expect(screen.queryByText(/Todavía no hay reservas/)).toBeNull()
    })

    it("error con datos: se conserva el análisis y se avisa que son los últimos datos", () => {
        billing("ready", { refreshFailed: true })
        render(<BillingDashboard />)
        expect(within(activity()).getByText(/No pudimos actualizar el consumo\. Se muestran los últimos datos cargados\./)).toBeInTheDocument()
        expect(within(activity()).getByText("4,00 USD")).toBeInTheDocument()
        expect(within(activity()).getByRole("heading", { name: "Historial" })).toBeInTheDocument()
        expect(screen.queryByRole("alert")).toBeNull()
    })

    it("202 sin datos: estado de sincronización, no un error rojo", () => {
        billing("syncing")
        render(<BillingDashboard />)

        expect(screen.queryByRole("alert")).toBeNull()
        const message = within(activity()).getByText("Las reservas se están sincronizando").closest("[role='status']") as HTMLElement
        fireEvent.click(within(message).getByRole("button", { name: "Reintentar" }))
        expect(mocks.retry).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/0,00 USD/)).toBeNull()
    })

    it("202 con datos: se conservan los datos y se avisa la sincronización", () => {
        billing("ready", { syncing: true })
        render(<BillingDashboard />)
        expect(within(activity()).getByText(/Las reservas se están sincronizando\. Se muestran los últimos datos cargados\./)).toBeInTheDocument()
        expect(within(activity()).getByText("4,00 USD")).toBeInTheDocument()
    })

    it("parcial: el aviso va dentro del nivel 2, ANTES del análisis; las filas fallidas, en la tabla", () => {
        billing("partial", { failedReservations: [failure("r-1", "Beto Ruiz"), failure("r-2", "Carla Díaz"), failure("r-3", "Dani Paz")] })
        render(<BillingDashboard />)

        const notice = within(activity()).getByText("No se pudo consultar el consumo de 3 reservas. Las cifras mostradas pueden estar incompletas.")
        const amount = within(activity()).getByText("4,00 USD")
        expect(notice.compareDocumentPosition(amount) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        const row = screen.getByText("Beto Ruiz").closest("tr")!
        expect(row).toHaveTextContent("Consumo no disponible")
        expect(row).not.toHaveTextContent("USD")
        expect(screen.getByText("Ana Gómez").closest("tr")).toHaveTextContent("4,00")
    })

    it("una sola reserva fallida se nombra en singular", () => {
        billing("partial", { failedReservations: [failure("r-1", "Beto Ruiz")] })
        render(<BillingDashboard />)
        expect(screen.getByText(/el consumo de 1 reserva\. /)).toBeInTheDocument()
    })

    it("el aviso parcial permanece visible mientras actualiza", () => {
        billing("refreshing", { failedReservations: [failure("r-1", "Beto Ruiz")] })
        render(<BillingDashboard />)
        expect(screen.getByText("Actualizando…")).toBeInTheDocument()
        expect(screen.getByText(/No se pudo consultar el consumo de 1 reserva/)).toBeInTheDocument()
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
