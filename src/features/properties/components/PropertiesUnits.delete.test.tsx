import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const mocks = vi.hoisted(() => ({ deleteListing: vi.fn(), notifyError: vi.fn(), toastSuccess: vi.fn() }))

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getRoomTypes: async () => [], getCurrencies: async () => [], getAmenities: async () => [], getPmsSources: async () => [] },
}))
vi.mock("../services/listings-service", () => ({ listingsService: { delete: mocks.deleteListing } }))
vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return { ...actual, automationService: { listGlobal: async () => [], listListingOverrides: async () => [] } }
})
vi.mock("@/lib/notify-error", () => ({ notifyError: mocks.notifyError }))
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { PropertiesUnits } from "./PropertiesUnits"

function Wrapper({ children, units }: { children: ReactNode; units: unknown[] }) {
    const form = useForm({ defaultValues: { uuid: "p-1", statusRecordId: 6, units } })
    return <FormProvider {...form}>{children}</FormProvider>
}

const SAVED = { uuid: "l-1", name: "Suite 101", internalName: "101", isActive: true }

function renderUnits(units: unknown[] = [SAVED]) {
    const user = userEvent.setup()
    render(<Wrapper units={units}><PropertiesUnits /></Wrapper>)
    return user
}

describe("PropertiesUnits — eliminar un alojamiento pide confirmación", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("la papelera tiene nombre, abre la confirmación con la consecuencia y no borra nada todavía; Cancelar no borra", async () => {
        const user = renderUnits()
        await user.click(screen.getByRole("button", { name: "Eliminar Suite 101" }))

        const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar este alojamiento?" })
        expect(dialog).toHaveTextContent("Se elimina Suite 101 de esta propiedad")
        expect(dialog).toHaveTextContent("Sus reservas se conservan, pero quedan sin alojamiento")
        expect(dialog).toHaveTextContent("puedes desactivarlo; un alojamiento inactivo se puede reactivar")
        expect(within(dialog).getByRole("button", { name: "Eliminar alojamiento" })).toBeInTheDocument()
        expect(mocks.deleteListing).not.toHaveBeenCalled()

        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(mocks.deleteListing).not.toHaveBeenCalled()
        expect(screen.getByText("Suite 101")).toBeInTheDocument()
    })

    it("al confirmar: «Eliminando…», sin doble envío ni cierre; al terminar sale la fila", async () => {
        let finish!: () => void
        mocks.deleteListing.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
        const user = renderUnits()
        await user.click(screen.getByRole("button", { name: "Eliminar Suite 101" }))
        const dialog = await screen.findByRole("alertdialog")
        const action = within(dialog).getByRole("button", { name: "Eliminar alojamiento" })

        await user.click(action)
        expect(within(dialog).getByRole("button", { name: "Eliminando…" })).toHaveAttribute("aria-busy", "true")
        expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled()
        await user.keyboard("{Escape}")
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
        await user.click(within(dialog).getByRole("button", { name: "Eliminando…" }))
        expect(mocks.deleteListing).toHaveBeenCalledTimes(1)
        expect(mocks.deleteListing).toHaveBeenCalledWith("l-1")

        finish()
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(screen.queryByText("Suite 101")).toBeNull()
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Alojamiento eliminado")
    })

    it("si falla: avisa, el diálogo sigue abierto para reintentar o cancelar y la fila no se va", async () => {
        mocks.deleteListing.mockRejectedValueOnce(new Error("500"))
        const user = renderUnits()
        await user.click(screen.getByRole("button", { name: "Eliminar Suite 101" }))
        const dialog = await screen.findByRole("alertdialog")
        await user.click(within(dialog).getByRole("button", { name: "Eliminar alojamiento" }))

        await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledWith(expect.any(Error), "No pudimos eliminar el alojamiento"))
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
        expect(within(dialog).getByRole("button", { name: "Eliminar alojamiento" })).toBeEnabled()
        // La fila sigue en la tabla (el nombre también aparece dentro del diálogo).
        expect(screen.getByRole("cell", { name: "Suite 101", hidden: true })).toBeInTheDocument()
    })

    it("una fila sin guardar sale del formulario sin preguntar (no hay nada que borrar en el backend)", async () => {
        const user = renderUnits([{ name: "Borrador" }])
        await user.click(screen.getByRole("button", { name: "Eliminar Borrador" }))
        expect(screen.queryByRole("alertdialog")).toBeNull()
        expect(screen.queryByText("Borrador")).toBeNull()
        expect(mocks.deleteListing).not.toHaveBeenCalled()
    })

    it("el foco empieza en «Cancelar» y, tras un fallo, reintentar funciona", async () => {
        mocks.deleteListing.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(undefined)
        const user = renderUnits()
        await user.click(screen.getByRole("button", { name: "Eliminar Suite 101" }))
        const dialog = await screen.findByRole("alertdialog")
        await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus())

        await user.click(within(dialog).getByRole("button", { name: "Eliminar alojamiento" }))
        await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled())
        await user.click(within(dialog).getByRole("button", { name: "Eliminar alojamiento" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(mocks.deleteListing).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole("cell", { name: "Suite 101" })).toBeNull()
    })

    it("cancelar después de un fallo no borra nada", async () => {
        mocks.deleteListing.mockRejectedValueOnce(new Error("500"))
        const user = renderUnits()
        await user.click(screen.getByRole("button", { name: "Eliminar Suite 101" }))
        const dialog = await screen.findByRole("alertdialog")
        await user.click(within(dialog).getByRole("button", { name: "Eliminar alojamiento" }))
        await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled())
        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(mocks.deleteListing).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("cell", { name: "Suite 101" })).toBeInTheDocument()
    })

    it("la sugerencia de desactivar solo aparece si el alojamiento está activo", async () => {
        const user = renderUnits([{ ...SAVED, isActive: false }])
        await user.click(screen.getByRole("button", { name: "Eliminar Suite 101" }))
        const dialog = await screen.findByRole("alertdialog")
        expect(dialog).not.toHaveTextContent("puedes desactivarlo")

        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    })
})

