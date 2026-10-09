import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ReservationStatusIcon } from "./ReservationStatusIcon"

describe("ReservationStatusIcon — el «?» solo cuando de verdad no se sabe", () => {
    it("Abandonada e Incompleta tienen icono y etiqueta propios", () => {
        render(<ReservationStatusIcon status="ABANDONED" />)
        expect(screen.getByLabelText("Abandonada · sin automatizaciones")).toBeInTheDocument()
    })

    it("un estado no mapeado se nombra como lo nombra el backend", () => {
        render(<ReservationStatusIcon status="UNKNOWN" backendLabel="En espera" />)
        expect(screen.getByLabelText("En espera · sin automatizaciones")).toBeInTheDocument()
    })

    it("sin nombre del backend sigue diciendo Desconocido", () => {
        render(<ReservationStatusIcon status="UNKNOWN" />)
        expect(screen.getByLabelText("Desconocido · sin automatizaciones")).toBeInTheDocument()
    })
})
