import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

const state = vi.hoisted(() => ({
    value: {} as Record<string, unknown>,
}))

vi.mock("@/features/reservations/hooks/useAutomationStatus", () => ({
    useAutomationStatus: () => state.value,
    hasPendingWork: () => false,
}))

import { AutomationStatusList } from "./AutomationStatusList"

function hookState(over: Record<string, unknown> = {}) {
    return {
        items: [],
        isLoading: false,
        error: null,
        redispatchingKeys: new Set(),
        dispatchingKeys: new Set(),
        now: Date.now(),
        cooldownUntil: {},
        refresh: vi.fn().mockResolvedValue(undefined),
        redispatch: vi.fn(),
        dispatch: vi.fn(),
        resendPdf: vi.fn(),
        ...over,
    }
}

describe("AutomationStatusList — estados (Fase 2.5)", () => {
    beforeEach(() => {
        state.value = hookState()
    })

    it("la carga inicial es un esqueleto con la forma de las tarjetas, anunciado", () => {
        state.value = hookState({ isLoading: true })
        const { container } = render(<AutomationStatusList reservationUuid="r1" totalGuests={2} />)
        // Dos regiones status: la de carga (con texto) y la del indicador, vacía.
        expect(screen.getByText("Cargando automatizaciones…")).toHaveAttribute("role", "status")
        expect(document.querySelector("[data-slot=refresh-indicator]")).toBeEmptyDOMElement()
        expect(container.querySelectorAll("[data-slot=skeleton]")).toHaveLength(4)
    })

    it("sin automatizaciones es un vacío compartido (no se anuncia)", () => {
        render(<AutomationStatusList reservationUuid="r1" totalGuests={2} />)
        const empty = screen.getByText("No hay automatizaciones configuradas para esta propiedad.").closest("[data-slot=empty-state]")
        expect(empty).toHaveAttribute("data-kind", "empty")
        expect(empty).not.toHaveAttribute("role")
    })

    it("Refrescar conserva lo que se ve y avisa «Actualizando…» hasta que termina", async () => {
        let finish!: () => void
        const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
        state.value = hookState({ refresh })
        render(<AutomationStatusList reservationUuid="r1" totalGuests={2} />)
        const indicator = document.querySelector("[data-slot=refresh-indicator]")!
        expect(indicator).toBeEmptyDOMElement()

        fireEvent.click(screen.getByRole("button", { name: "Refrescar" }))
        expect(refresh).toHaveBeenCalledTimes(1)
        expect(indicator).toHaveTextContent("Actualizando…")
        // `Button loading`: en curso (aria-busy) y sin doble clic, sin `disabled`.
        expect(screen.getByRole("button", { name: "Refrescar" })).toHaveAttribute("aria-busy", "true")
        expect(screen.getByText("No hay automatizaciones configuradas para esta propiedad.")).toBeInTheDocument()

        await act(async () => { finish() })
        expect(indicator).toBeEmptyDOMElement()
        expect(screen.getByRole("button", { name: "Refrescar" })).not.toHaveAttribute("aria-busy")
    })
})
