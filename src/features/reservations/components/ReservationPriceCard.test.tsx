import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ReservationPriceCard } from "./ReservationPriceCard"

const declaration = { amount: 850000, currency: "COP", guestUuid: "g1", declaredAt: "2026-10-01T15:04:05+00:00" }

describe("ReservationPriceCard (contrato 2026-09-27 §2.1)", () => {
    it("QA 5: valor declarado por el huésped → badge y acción de corregir", () => {
        const onCorrect = vi.fn()
        render(
            <ReservationPriceCard
                totalPrice={850000}
                currency="COP"
                nights={2}
                priceDeclaredByGuest
                guestPriceDeclaration={declaration}
                onCorrect={onCorrect}
            />,
        )
        expect(screen.getByText("Valor declarado por el huésped")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Corregir valor" }))
        expect(onCorrect).toHaveBeenCalledOnce()
        expect(screen.getByText(/El huésped declaró/)).toBeInTheDocument()
        expect(screen.getByText(/2026/)).toBeInTheDocument()
    })

    it("QA 6: tras corregir, el badge se va y el historial se conserva", () => {
        render(
            <ReservationPriceCard
                totalPrice={780000}
                currency="COP"
                nights={2}
                priceDeclaredByGuest={false}
                guestPriceDeclaration={declaration}
                onCorrect={vi.fn()}
            />,
        )
        expect(screen.queryByText("Valor declarado por el huésped")).toBeNull()
        expect(screen.queryByRole("button", { name: "Corregir valor" })).toBeNull()
        expect(screen.getByText(/El huésped declaró/)).toBeInTheDocument()
        expect(screen.getByText(/780\.000/)).toBeInTheDocument()
    })

    it("usa el símbolo de la moneda real y avisa cuando falta, sin inventar COP", () => {
        const { rerender } = render(
            <ReservationPriceCard totalPrice={1200} currency="EUR" nights={1} priceDeclaredByGuest={false} guestPriceDeclaration={null} onCorrect={vi.fn()} />,
        )
        expect(screen.getByText(/€|EUR/)).toBeInTheDocument()
        expect(screen.queryByText(/\$/)).toBeNull()

        rerender(
            <ReservationPriceCard totalPrice={1200} currency={null} nights={1} priceDeclaredByGuest={false} guestPriceDeclaration={null} onCorrect={vi.fn()} />,
        )
        expect(screen.getByText(/no informa su moneda/)).toBeInTheDocument()
        expect(screen.queryByText(/COP/)).toBeNull()
    })
})
