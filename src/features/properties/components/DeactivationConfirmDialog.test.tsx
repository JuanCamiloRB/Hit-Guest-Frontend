import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
