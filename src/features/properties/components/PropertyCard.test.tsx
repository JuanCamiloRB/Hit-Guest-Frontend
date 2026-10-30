import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Property } from "@/types"

const mocks = vi.hoisted(() => ({ patch: vi.fn() }))
vi.mock("../services/properties-service", () => ({ propertiesService: { patch: mocks.patch } }))
vi.mock("../hooks/usePropertyTypeLabel", () => ({ usePropertyTypeLabel: () => null }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/reservations/services/reservations-service", () => ({
    reservationsService: { countAffectedReservations: async () => 3 },
}))

import { PropertyCard } from "./PropertyCard"

function property(status: "ACTIVE" | "INACTIVE"): Property {
    return { uuid: "p-1", id: "p-1", name: "Casa del Mar", status } as unknown as Property
}

describe("PropertyCard — desactivar pide confirmación (pedido 2026-10-27)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.patch.mockResolvedValue({})
    })

    it("apagar el switch abre la confirmación y NO guarda nada todavía", async () => {
        render(<PropertyCard property={property("ACTIVE")} />)
        await userEvent.setup().click(screen.getByRole("switch"))

        expect(screen.getByRole("alertdialog")).toHaveTextContent("Se detienen las automatizaciones de sus reservas")
        expect(mocks.patch).not.toHaveBeenCalled()
        // Con el diálogo abierto el fondo queda oculto a la accesibilidad.
        expect(screen.getByRole("switch", { hidden: true })).toBeChecked()
    })

    it("cancelar la deja activa, sin cambios", async () => {
        const onStatusChange = vi.fn()
        render(<PropertyCard property={property("ACTIVE")} onStatusChange={onStatusChange} />)
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        await user.click(screen.getByRole("button", { name: "Cancelar" }))

        expect(mocks.patch).not.toHaveBeenCalled()
        expect(onStatusChange).not.toHaveBeenCalled()
        expect(screen.getByRole("switch")).toBeChecked()
    })

    it("confirmar desactiva (statusRecordId 7)", async () => {
        const onStatusChange = vi.fn()
        render(<PropertyCard property={property("ACTIVE")} onStatusChange={onStatusChange} />)
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        await user.click(screen.getByRole("button", { name: "Desactivar y detener automatizaciones" }))

        await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("p-1", { statusRecordId: 7 }))
        expect(onStatusChange).toHaveBeenCalledWith("p-1", "INACTIVE")
    })

    it("activar no pregunta", async () => {
        render(<PropertyCard property={property("INACTIVE")} />)
        await userEvent.setup().click(screen.getByRole("switch"))

        expect(screen.queryByRole("alertdialog")).toBeNull()
        await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("p-1", { statusRecordId: 6 }))
    })
})
