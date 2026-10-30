import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mocks = vi.hoisted(() => ({ count: vi.fn() }))
vi.mock("@/features/reservations/services/reservations-service", () => ({
    reservationsService: { countAffectedReservations: mocks.count },
}))

import { DeactivationConfirmDialog } from "./DeactivationConfirmDialog"

describe("DeactivationConfirmDialog", () => {
    it("alojamiento: el texto exacto del contrato 2026-10-27, en lista", () => {
        render(<DeactivationConfirmDialog target={{ kind: "listing", name: "Apto 101" }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
        const dialog = screen.getByRole("alertdialog")
        expect(dialog).toHaveTextContent("¿Desactivar este alojamiento?")
        expect(dialog).toHaveTextContent("Apto 101")
        expect(dialog).toHaveTextContent("Al desactivar este alojamiento:")
        const items = screen.getAllByRole("listitem").map((item) => item.textContent)
        expect(items).toHaveLength(7)
        expect(items[0]).toBe("Se detienen las automatizaciones de sus reservas confirmadas, en curso e incompletas.")
        expect(items[6]).toBe("Al reactivarlo, nada se ejecuta solo: reenvía los links de check-in.")
    })

    it("propiedad: lo mismo con el género ajustado, más sus dos líneas propias", () => {
        render(<DeactivationConfirmDialog target={{ kind: "property", name: "Casa del Mar" }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
        expect(screen.getByRole("alertdialog")).toHaveTextContent("Al desactivar esta propiedad:")
        const items = screen.getAllByRole("listitem").map((item) => item.textContent)
        expect(items).toHaveLength(9)
        expect(items).toContain("No se podrán crear, mover, reactivar ni restaurar reservas en ella.")
        expect(items).toContain("Se desactivan todos sus alojamientos activos; al reactivar la propiedad vuelven esos mismos (los que desactivaste a mano siguen inactivos).")
        expect(items).toContain("Mientras esté inactiva, no podrás activar, crear activos, mover ni restaurar alojamientos en ella.")
    })

    it("confirmar llama solo a onConfirm (no también a onCancel al cerrarse)", async () => {
        const onConfirm = vi.fn()
        const onCancel = vi.fn()
        render(<DeactivationConfirmDialog target={{ kind: "property", name: "Casa" }} onConfirm={onConfirm} onCancel={onCancel} />)
        await userEvent.setup().click(screen.getByRole("button", { name: "Desactivar y detener automatizaciones" }))
        expect(onConfirm).toHaveBeenCalledTimes(1)
        expect(onCancel).not.toHaveBeenCalled()
    })

    it("Cancelar viene enfocado y solo cancela", async () => {
        const onConfirm = vi.fn()
        const onCancel = vi.fn()
        render(<DeactivationConfirmDialog target={{ kind: "property", name: "Casa" }} onConfirm={onConfirm} onCancel={onCancel} />)
        expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus()
        await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }))
        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(onConfirm).not.toHaveBeenCalled()
    })
})

describe("DeactivationConfirmDialog — reservas afectadas (contrato 2026-10-27 §2.6)", () => {
    beforeEach(() => vi.clearAllMocks())

    it("cuenta las del alojamiento y lo destaca", async () => {
        mocks.count.mockResolvedValue(12)
        render(<DeactivationConfirmDialog target={{ kind: "listing", name: "Apto 101", uuid: "l-1" }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
        expect(screen.getByText("Calculando las reservas afectadas…")).toBeInTheDocument()
        expect(await screen.findByText("Se pausarán las automatizaciones de 12 reservas afectadas.")).toBeInTheDocument()
        expect(mocks.count).toHaveBeenCalledWith({ listingUuid: "l-1" }, expect.any(AbortSignal))
    })

    it("de una propiedad, por su uuid", async () => {
        mocks.count.mockResolvedValue(1)
        render(<DeactivationConfirmDialog target={{ kind: "property", name: "Casa", uuid: "p-1" }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
        expect(await screen.findByText("Se pausarán las automatizaciones de 1 reserva afectada.")).toBeInTheDocument()
        expect(mocks.count).toHaveBeenCalledWith({ propertyUuid: "p-1" }, expect.any(AbortSignal))
    })

    it("si el conteo falla, lo dice y se puede desactivar igual", async () => {
        mocks.count.mockRejectedValue(new Error("red"))
        const onConfirm = vi.fn()
        render(<DeactivationConfirmDialog target={{ kind: "listing", name: "Apto", uuid: "l-1" }} onConfirm={onConfirm} onCancel={vi.fn()} />)
        expect(await screen.findByText("No pudimos calcular cuántas reservas están afectadas.")).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole("button", { name: "Desactivar y detener automatizaciones" }))
        expect(onConfirm).toHaveBeenCalled()
    })

    it("sin uuid (unidad nueva) no cuenta nada", () => {
        render(<DeactivationConfirmDialog target={{ kind: "listing", name: "Nueva" }} onConfirm={vi.fn()} onCancel={vi.fn()} />)
        expect(mocks.count).not.toHaveBeenCalled()
        expect(screen.queryByRole("status")).toBeNull()
    })
})
