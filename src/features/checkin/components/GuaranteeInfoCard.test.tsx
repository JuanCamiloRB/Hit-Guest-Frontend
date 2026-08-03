import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { GuaranteeInfoCard } from "./GuaranteeInfoCard"

/**
 * Only real interaction check for this component (Ricardo/Didier thread
 * 20260801) — no live reservation was available to click through it in an
 * actual browser, so this is what stands in for that: real DOM, real click,
 * real callback firing, not just a JSX read-through.
 */
describe("GuaranteeInfoCard", () => {
    it("renders the lifecycle, FAQ, and CTA copy", () => {
        render(<GuaranteeInfoCard onContinue={() => {}} />)
        expect(screen.getByText("Registrada")).toBeInTheDocument()
        expect(screen.getByText("Protegida")).toBeInTheDocument()
        expect(screen.getByText("Eliminada")).toBeInTheDocument()
        expect(screen.getByText("¿Por qué piden una tarjeta?")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Continuar con confianza/i })).toBeInTheDocument()
    })

    it("calls onContinue when the CTA is clicked — this is the actual tokenization gate", async () => {
        const onContinue = vi.fn()
        const user = userEvent.setup()
        render(<GuaranteeInfoCard onContinue={onContinue} />)

        await user.click(screen.getByRole("button", { name: /Continuar con confianza/i }))
        expect(onContinue).toHaveBeenCalledTimes(1)
    })

    it("opens a closed FAQ item on click (native <details> accordion)", async () => {
        const user = userEvent.setup()
        render(<GuaranteeInfoCard onContinue={() => {}} />)

        const question = screen.getByText("¿Me cobran algo ahora?")
        const details = question.closest("details") as HTMLDetailsElement
        expect(details.open).toBe(false)

        await user.click(question)
        expect(details.open).toBe(true)
    })
})
