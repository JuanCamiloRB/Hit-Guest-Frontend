import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const mocks = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))
import userEvent from "@testing-library/user-event"
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getRoomTypes: async () => [{ id: 3, name: "Suite" }], getCurrencies: async () => [], getAmenities: async () => [], getPmsSources: async () => [] },
}))
vi.mock("../services/listings-service", () => ({ listingsService: {} }))
vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return { ...actual, automationService: { listGlobal: async () => [], listListingOverrides: async () => [] } }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { PropertiesUnits } from "./PropertiesUnits"

const UNITS = [
    { uuid: "l-1", name: "Suite 101", internalName: "101", isActive: true, extra: {} },
    { uuid: "l-2", name: "Suite 202", internalName: "202", isActive: true, extra: {} },
]

function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm({ defaultValues: { uuid: "p-1", statusRecordId: 6, units: UNITS } })
    return <FormProvider {...form}>{children}</FormProvider>
}

describe("PropertiesUnits — `?unit=` abre ese alojamiento al llegar", () => {
    beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}) })

    it("con `?unit=l-2` se abre el diálogo de edición de «Suite 202»", async () => {
        mocks.params = new URLSearchParams("tab=units&unit=l-2")
        render(<Wrapper><PropertiesUnits /></Wrapper>)
        const dialog = await screen.findByRole("dialog", { name: "Editar alojamiento" })
        expect(dialog).toBeInTheDocument()
        expect(screen.getByLabelText(/Nombre del alojamiento/)).toHaveValue("Suite 202")
    })

    it("cerrar el diálogo quita solo `unit` de la URL (conserva `tab`), por Escape o por Cancelar", async () => {
        const user = userEvent.setup()
        window.history.replaceState(null, "", "/dashboard/properties/p-1?tab=units&unit=l-2")
        mocks.params = new URLSearchParams("tab=units&unit=l-2")
        const { rerender } = render(<Wrapper><PropertiesUnits /></Wrapper>)
        await screen.findByRole("dialog", { name: "Editar alojamiento" })
        const entries = window.history.length
        await user.keyboard("{Escape}")
        // Solo `unit` se va; `tab` se queda; sin entrada nueva en el historial.
        expect(window.location.pathname + window.location.search).toBe("/dashboard/properties/p-1?tab=units")
        expect(window.history.length).toBe(entries)

        // La URL ya sin `unit`: no se vuelve a abrir solo…
        mocks.params = new URLSearchParams("tab=units")
        rerender(<Wrapper><PropertiesUnits /></Wrapper>)
        await new Promise((r) => setTimeout(r, 10))
        expect(screen.queryByRole("dialog")).toBeNull()
        // …pero volver a `?unit=l-2` (atrás del navegador) sí lo abre otra vez, y Cancelar vuelve a limpiar.
        mocks.params = new URLSearchParams("tab=units&unit=l-2")
        rerender(<Wrapper><PropertiesUnits /></Wrapper>)
        window.history.replaceState(null, "", "/dashboard/properties/p-1?tab=units&unit=l-2")
        const dialog = await screen.findByRole("dialog", { name: "Editar alojamiento" })
        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
        expect(window.location.search).toBe("?tab=units")
        // Radix devuelve el foco al desmontar en un `setTimeout`: se deja pasar dentro de la
        // prueba, no en la siguiente (dispararía un evento de otro documento).
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    })

    it("sin `?unit=`, o con uno que no existe, no se abre nada", async () => {
        mocks.params = new URLSearchParams("tab=units&unit=l-9")
        render(<Wrapper><PropertiesUnits /></Wrapper>)
        await screen.findByRole("button", { name: "Editar Suite 101" })
        expect(screen.queryByRole("dialog")).toBeNull()
    })
})
