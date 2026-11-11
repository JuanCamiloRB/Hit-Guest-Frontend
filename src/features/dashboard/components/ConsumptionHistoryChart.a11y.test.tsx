import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConsumptionHistoryChart } from "./ConsumptionHistoryChart"

const month = (m: number, total: number) => ({ date: new Date(2026, m, 1), total })
const monthly = [month(5, 0), month(6, 0.3), month(7, 0), month(8, 0.06), month(9, 0.75), month(10, 0.1)]

describe("ConsumptionHistoryChart — datos legibles sin mouse y con la marca", () => {
    it("cada mes se puede enfocar y dice su valor (antes solo el tooltip del mouse)", () => {
        render(<ConsumptionHistoryChart monthly={monthly} refMonth={new Date(2026, 10, 1)} />)
        const months = screen.getAllByRole("img")
        expect(months).toHaveLength(6)
        months.forEach((m) => expect(m).toHaveAttribute("tabindex", "0"))
        expect(screen.getByRole("img", { name: "noviembre 2026: 0,10 USD (mes seleccionado)" })).toBeInTheDocument()
        expect(screen.getByRole("img", { name: "octubre 2026: 0,75 USD" })).toBeInTheDocument()
    })

    it("el mes elegido en morado sólido; el resto al 20 % con borde superior que define la barra", () => {
        render(<ConsumptionHistoryChart monthly={monthly} refMonth={new Date(2026, 10, 1)} />)
        const selected = screen.getByRole("img", { name: /mes seleccionado/ })
        const other = screen.getByRole("img", { name: /octubre 2026/ })
        const bar = (col: HTMLElement) => col.querySelector<HTMLElement>(".rounded-t")!
        expect(bar(selected)).toHaveClass("bg-primary")
        expect(bar(other)).toHaveClass("bg-primary/20", "border-t-2", "border-primary/70")
        expect(bar(other).className).not.toMatch(/ink-4/)
    })
})
