import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { MovementMark, MOVEMENT_LABEL } from "./movement-mark"

describe("MovementMark", () => {
    it("check-in: verde (success) con la flecha que entra en blanco; checkout: naranja (warning) con la que sale", () => {
        const { rerender, container } = render(<MovementMark kind="checkin" />)
        const mark = () => container.querySelector('[data-slot="movement-mark"]')!
        expect(mark()).toHaveAttribute("data-kind", "checkin")
        expect(mark()).toHaveClass("bg-success", "text-white", "size-6", "rounded-md")
        expect(mark().querySelector(".lucide-log-in")).not.toBeNull()
        rerender(<MovementMark kind="checkout" />)
        expect(mark()).toHaveClass("bg-warning", "text-white")
        expect(mark().querySelector(".lucide-log-out")).not.toBeNull()
    })

    it("decorativa sin label; con label es una imagen con nombre", () => {
        const { rerender, container } = render(<MovementMark kind="checkin" />)
        expect(container.querySelector('[data-slot="movement-mark"]')).toHaveAttribute("aria-hidden", "true")
        rerender(<MovementMark kind="checkin" label="Check-in hoy" />)
        expect(screen.getByRole("img", { name: "Check-in hoy" })).toBeInTheDocument()
    })

    it("bordered: borde blanco de 2 px para separarla de la barra morada; sm más chica", () => {
        const { container } = render(<MovementMark kind="checkout" bordered size="sm" />)
        expect(container.querySelector('[data-slot="movement-mark"]')).toHaveClass("border-2", "border-white", "size-5")
    })

    it("las palabras de la leyenda", () => {
        expect(MOVEMENT_LABEL).toEqual({ checkin: "Check-in", checkout: "Checkout" })
    })
})
