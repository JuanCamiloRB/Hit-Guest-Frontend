import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getBalance: vi.fn() }))
vi.mock("../services/billing-service", () => ({ billingService: { getBalance: mocks.getBalance } }))

import { useBalanceStore } from "../hooks/useBalanceStore"
import { BalanceWidget } from "./BalanceWidget"

async function widgetWith(amount: number) {
    mocks.getBalance.mockResolvedValue({ amount, currency: "USD" })
    useBalanceStore.setState({ amount: null, currency: "USD", pending: false, isLoading: false, loaded: false, error: false })
    render(<BalanceWidget />)
    return screen.findByRole("link", { name: "Ver saldo y recargar" }, { timeout: 2000 }).then(async (link) => {
        await screen.findByText(new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2 }).format(amount))
        return link
    })
}

describe("BalanceWidget — el saldo del header", () => {
    beforeEach(() => vi.clearAllMocks())

    it("con saldo: morado claro (accent), la cifra en Gabarito y «USD» UNA sola vez", async () => {
        const link = await widgetWith(10)
        expect(link).toHaveAttribute("data-balance-state", "normal")
        expect(link).toHaveAttribute("data-variant", "accent")
        expect(link).toHaveClass("bg-primary/10", "border-primary/30", "text-ink")
        const figure = link.querySelector('[data-slot="figure"]')
        expect(figure).toHaveTextContent(/^10,00$/)
        expect(figure).toHaveClass("font-sans", "font-bold")
        // Antes decía «10,00 USD USD».
        expect(link.textContent?.match(/USD/g)).toHaveLength(1)
        expect(link.querySelector(".lucide-wallet")).toHaveClass("text-primary-hover")
    })

    it("saldo bajo: el color del aviso, no el morado", async () => {
        const link = await widgetWith(3)
        expect(link).toHaveAttribute("data-variant", "outline-warning")
        expect(link.querySelector('[data-slot="figure"]')).toHaveAttribute("data-tone", "warning")
        expect(link.querySelector(".lucide-triangle-alert, .lucide-alert-triangle")).not.toBeNull()
    })

    it("saldo agotado: rojo", async () => {
        const link = await widgetWith(0)
        expect(link).toHaveAttribute("data-variant", "outline-destructive")
        expect(link.querySelector('[data-slot="figure"]')).toHaveAttribute("data-tone", "danger")
    })
})
