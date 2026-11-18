import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), update: vi.fn() }))
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))
import userEvent from "@testing-library/user-event"
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getRoomTypes: async () => [{ id: 3, name: "Suite" }], getCurrencies: async () => [], getAmenities: async () => [], getPmsSources: async () => [] },
}))
vi.mock("../services/listings-service", () => ({ listingsService: { update: mocks.update } }))
vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return { ...actual, automationService: { listGlobal: async () => [], listListingOverrides: async () => [] } }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { PropertiesUnits } from "./PropertiesUnits"

const UNITS = [
    { uuid: "l-1", name: "Suite 101", internalName: "101", isActive: true, extra: {} },
    { uuid: "l-2", name: "Suite 202", internalName: "202", isActive: true, roomTypeId: 3, contactEmail: "suite@mirador.co", extra: {} },
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
        // Como en el App Router real: su propio estado en `history.state`.
        window.history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: {} }, "", "/dashboard/properties/p-1?tab=units&unit=l-2")
        mocks.params = new URLSearchParams("tab=units&unit=l-2")
        const { rerender } = render(<Wrapper><PropertiesUnits /></Wrapper>)
        await screen.findByRole("dialog", { name: "Editar alojamiento" })
        const entries = window.history.length
        const replaceState = vi.spyOn(window.history, "replaceState")
        await user.keyboard("{Escape}")
        // `state` en null A PROPÓSITO: con su propio `history.state` (`__NA`) el App
        // Router lo toma por llamada interna y no actualiza `useSearchParams`.
        expect(replaceState).toHaveBeenCalledTimes(1)
        expect(replaceState.mock.calls[0][0]).toBeNull()
        replaceState.mockRestore()
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

    it("editar y guardar «250.000» envía 250000 (raíz y extra), no 250", async () => {
        const user = userEvent.setup()
        mocks.update.mockResolvedValue({ uuid: "l-2", name: "Suite 202" })
        mocks.params = new URLSearchParams("tab=units&unit=l-2")
        render(<Wrapper><PropertiesUnits /></Wrapper>)
        const dialog = await screen.findByRole("dialog", { name: "Editar alojamiento" })
        const price = within(dialog).getByLabelText(/Precio inicial por noche/)
        await user.clear(price)
        await user.type(price, "250.000")
        await user.click(within(dialog).getByRole("button", { name: /Guardar/ }))
        await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
        const payload = mocks.update.mock.calls[0][1]
        expect(payload).toMatchObject({ price: 250000, start_price: 250000 })
        expect(payload.extra.startPrice).toBe(250000)
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    })
})
