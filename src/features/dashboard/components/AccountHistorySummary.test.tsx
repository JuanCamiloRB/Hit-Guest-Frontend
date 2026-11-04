import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ConsumptionSummary } from "@/features/billing/types"
import { AccountHistorySummary } from "./AccountHistorySummary"

const SUMMARY: ConsumptionSummary = {
    monthTotal: 0,
    prevMonthTotal: 0,
    monthDeltaPct: null,
    lifetime: { processedReservations: 20, avgPerReservation: 0.38, avgTrend: null },
    verifiedGuests: 0,
    grandTotal: 7.6,
}

describe("AccountHistorySummary — cifras de toda la cuenta, en una línea", () => {
    it("reservas con consumo facturado y su promedio, desde el inicio de la cuenta", () => {
        // `processedReservations` cuenta SOLO reservas con costo total > 0
        // (lifetimeCostStats); el promedio usa ese mismo denominador.
        render(<AccountHistorySummary summary={SUMMARY} isLoading={false} />)
        expect(screen.getByRole("region", { name: "Desde el inicio de la cuenta" })).toBeInTheDocument()
        expect(screen.getByText("20").closest("p")).toHaveTextContent("20 reservas con consumo facturado")
        expect(screen.getByText("0,38 USD").closest("p")).toHaveTextContent("0,38 USD promedio por reserva facturada")
        expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    })

    it("sin datos confiables muestra «—», nunca 0", () => {
        render(<AccountHistorySummary summary={null} isLoading={false} />)
        expect(screen.getAllByText("—")).toHaveLength(2)
        expect(screen.queryByText(/^0$/)).not.toBeInTheDocument()
    })

    it("sin reservas facturadas el promedio es «—», no 0 USD", () => {
        render(<AccountHistorySummary summary={{ ...SUMMARY, lifetime: { processedReservations: 0, avgPerReservation: null, avgTrend: null } }} isLoading={false} />)
        expect(screen.getByText("0")).toBeInTheDocument()
        expect(screen.getByText("—")).toBeInTheDocument()
        expect(screen.queryByText(/0,00 USD/)).not.toBeInTheDocument()
    })
})
