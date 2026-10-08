import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AvgTrendLine, BillingStatsCards } from "./BillingStatsCards"

vi.mock("@/features/billing/components/RechargeDialog", () => ({ RechargeDialog: () => null }))

const sep = new Date(2026, 8, 1)
const ago = new Date(2026, 7, 1)

describe("AvgTrendLine — hacia dónde va el costo promedio por reserva", () => {
    it("una subida se anuncia como subida, con porcentaje y los dos meses", () => {
        render(<AvgTrendLine trend={{ month: sep, baselineMonth: ago, deltaPct: 0.125 }} />)
        expect(screen.getByText("Sube")).toBeInTheDocument()
        expect(screen.getByText(/\+12,5 %/)).toHaveClass("text-red-600")
        expect(screen.getByText(/sept?\.? vs ago/i)).toBeInTheDocument()
    })

    it("una bajada se anuncia como bajada, en verde", () => {
        render(<AvgTrendLine trend={{ month: sep, baselineMonth: ago, deltaPct: -0.08 }} />)
        expect(screen.getByText("Baja")).toBeInTheDocument()
        expect(screen.getByText(/−8 %/)).toHaveClass("text-emerald-600")
    })

    it("un cambio de redondeo no se pinta como tendencia", () => {
        render(<AvgTrendLine trend={{ month: sep, baselineMonth: ago, deltaPct: 0.0001 }} />)
        expect(screen.getByText(/Sin cambio/)).toBeInTheDocument()
        expect(screen.queryByText("Sube")).not.toBeInTheDocument()
    })

    it("sin dos meses para comparar lo dice, sin inventar un 0 %", () => {
        render(<AvgTrendLine trend={null} />)
        expect(screen.getByText("Sin meses para comparar todavía")).toBeInTheDocument()
        expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    })
})

describe("BillingStatsCards — alcance histórico", () => {
    it("identifica el total y el promedio como cifras de todas las reservas procesadas", () => {
        render(
            <BillingStatsCards
                balance={null}
                balancePending
                isLoadingBalance={false}
                summary={{
                    monthTotal: 0,
                    prevMonthTotal: 0,
                    monthDeltaPct: null,
                    lifetime: { processedReservations: 3, avgPerReservation: 2, avgTrend: null },
                    verifiedGuests: 0,
                    grandTotal: 6,
                }}
                isLoadingCosts={false}
            />,
        )

        expect(screen.getByText("3")).toBeInTheDocument()
        expect(screen.getByText("2,00 USD")).toBeInTheDocument()
        expect(screen.getAllByText("Todas las reservas procesadas")).toHaveLength(2)
    })
})
