import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ConsumptionSummary } from "@/features/billing/types"
import { ActivitySummary, MonthDeltaLine } from "./ActivitySummary"

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

describe("ActivitySummary — la cifra del mes con su criterio y su variación", () => {
    it("muestra el consumo facturado, el mes por check-in y la variación en línea", () => {
        render(<ActivitySummary summary={summary()} refMonth={oct} />)
        expect(screen.getByText("Consumo facturado")).toBeInTheDocument()
        expect(screen.getByText("5,00 USD")).toBeInTheDocument()
        expect(screen.getByText("Reservas con check-in en octubre de 2026")).toBeInTheDocument()
        expect(screen.getByText("vs septiembre")).toBeInTheDocument()
    })
})

describe("MonthDeltaLine — variación del mes elegido contra el anterior", () => {
    it("una subida se anuncia como subida, en rojo, contra el mes anterior al elegido", () => {
        render(<MonthDeltaLine summary={summary()} refMonth={oct} />)
        expect(screen.getByText("Sube")).toBeInTheDocument()
        expect(screen.getByText(/\+25 %/)).toHaveClass("text-danger")
        expect(screen.getByText("vs septiembre")).toBeInTheDocument()
    })

    it("una bajada se anuncia como bajada, en verde", () => {
        render(<MonthDeltaLine summary={summary({ monthTotal: 3, monthDeltaPct: -0.25 })} refMonth={oct} />)
        expect(screen.getByText("Baja")).toBeInTheDocument()
        expect(screen.getByText(/−25 %/)).toHaveClass("text-success")
    })

    it("un cambio de redondeo no se pinta como tendencia, y va en neutro", () => {
        render(<MonthDeltaLine summary={summary({ monthDeltaPct: 0.0001 })} refMonth={oct} />)
        expect(screen.getByText("Sin cambio vs septiembre")).toHaveClass("text-ink-3")
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
