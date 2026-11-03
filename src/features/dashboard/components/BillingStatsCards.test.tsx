import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ConsumptionSummary } from "@/features/billing/types"
import { BillingStatsCards, MonthDeltaLine } from "./BillingStatsCards"

vi.mock("@/features/billing/components/RechargeDialog", () => ({ RechargeDialog: () => null }))

const oct = new Date(2026, 9, 1)
const ene = new Date(2027, 0, 1)

function summary(over: Partial<ConsumptionSummary> = {}): ConsumptionSummary {
    return {
        monthTotal: 5,
        prevMonthTotal: 4,
        monthDeltaPct: 0.25,
        lifetime: { processedReservations: 3, avgPerReservation: 2, avgTrend: null },
        verifiedGuests: 0,
        grandTotal: 6,
        ...over,
    }
}

describe("MonthDeltaLine — variación del mes elegido contra el anterior", () => {
    it("una subida se anuncia como subida, en rojo, contra el mes anterior al elegido", () => {
        render(<MonthDeltaLine summary={summary()} refMonth={oct} />)
        expect(screen.getByText("Sube")).toBeInTheDocument()
        expect(screen.getByText(/\+25 %/)).toHaveClass("text-red-600")
        expect(screen.getByText("vs septiembre")).toBeInTheDocument()
    })

    it("una bajada se anuncia como bajada, en verde", () => {
        render(<MonthDeltaLine summary={summary({ monthTotal: 3, monthDeltaPct: -0.25 })} refMonth={oct} />)
        expect(screen.getByText("Baja")).toBeInTheDocument()
        expect(screen.getByText(/−25 %/)).toHaveClass("text-emerald-600")
    })

    it("un cambio de redondeo no se pinta como tendencia", () => {
        render(<MonthDeltaLine summary={summary({ monthDeltaPct: 0.0001 })} refMonth={oct} />)
        expect(screen.getByText("Sin cambio vs septiembre")).toBeInTheDocument()
        expect(screen.queryByText("Sube")).not.toBeInTheDocument()
    })

    it("sin consumo el mes anterior lo dice, sin inventar un %", () => {
        render(<MonthDeltaLine summary={summary({ prevMonthTotal: 0, monthDeltaPct: null })} refMonth={oct} />)
        expect(screen.getByText("Sin consumo en septiembre para comparar")).toBeInTheDocument()
        expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    })

    it("en enero nombra el año del mes anterior", () => {
        render(<MonthDeltaLine summary={summary()} refMonth={ene} />)
        expect(screen.getByText("vs diciembre 2026")).toBeInTheDocument()
    })
})

describe("BillingStatsCards — cada cifra dice su alcance", () => {
    function renderCards(s: ConsumptionSummary | null = summary()) {
        render(
            <BillingStatsCards
                balance={null}
                isLoadingBalance={false}
                summary={s}
                isLoadingCosts={false}
                refMonth={oct}
            />,
        )
    }

    it("el consumo del mes nombra el mes y su criterio, con la variación al lado", () => {
        renderCards()
        expect(screen.getByText("Reservas con check-in en octubre de 2026")).toBeInTheDocument()
        expect(screen.getByText("vs septiembre")).toBeInTheDocument()
    })

    it("«Reservas con consumo facturado» y el promedio son de toda la cuenta", () => {
        // `processedReservations` cuenta SOLO reservas con costo total > 0
        // (lifetimeCostStats): una reserva con solo firma gratuita no entra.
        // Por eso el título dice «facturado» y no «procesadas».
        renderCards()
        expect(screen.getByText("RESERVAS CON CONSUMO FACTURADO")).toBeInTheDocument()
        expect(screen.queryByText(/RESERVAS PROCESADAS/)).not.toBeInTheDocument()
        expect(screen.getByText("3")).toBeInTheDocument()
        expect(screen.getByText("Desde el inicio de la cuenta")).toBeInTheDocument()
        expect(screen.getByText("2,00 USD")).toBeInTheDocument()
        expect(screen.getByText("Reservas con consumo facturado · desde el inicio de la cuenta")).toBeInTheDocument()
    })

    it("la cifra histórica ya no lleva una tendencia que no sigue al selector", () => {
        renderCards()
        // La única variación en pantalla es la del mes.
        expect(screen.getAllByText(/%/)).toHaveLength(1)
    })

    it("sin datos confiables no hay leyendas ni variación, solo «—»", () => {
        renderCards(null)
        expect(screen.getAllByText("—")).toHaveLength(3)
        expect(screen.queryByText(/vs septiembre/)).not.toBeInTheDocument()
        expect(screen.queryByText("Desde el inicio de la cuenta")).not.toBeInTheDocument()
    })
})
