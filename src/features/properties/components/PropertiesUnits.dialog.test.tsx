import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const mocks = vi.hoisted(() => ({
    createListing: vi.fn(),
    getRoomTypes: vi.fn(),
    getCurrencies: vi.fn(),
    toastSuccess: vi.fn(),
}))

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: {
        getRoomTypes: mocks.getRoomTypes,
        getCurrencies: mocks.getCurrencies,
        getAmenities: async () => [{ id: 46, name: "Piscina" }, { id: 47, name: "WiFi" }],
        getPmsSources: async () => [],
    },
}))
vi.mock("../services/listings-service", () => ({ listingsService: { create: mocks.createListing } }))
vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return { ...actual, automationService: { listGlobal: async () => [], listListingOverrides: async () => [] } }
})
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { PropertiesUnits } from "./PropertiesUnits"

function Wrapper({ children, units = [] }: { children: ReactNode; units?: unknown[] }) {
    const form = useForm({ defaultValues: { uuid: "p-1", statusRecordId: 6, units } })
    return <FormProvider {...form}>{children}</FormProvider>
}

async function openNewUnit() {
    const user = userEvent.setup()
    render(<Wrapper><PropertiesUnits /></Wrapper>)
    await user.click(screen.getByRole("button", { name: "Añadir alojamiento" }))
    const dialog = await screen.findByRole("dialog", { name: "Añadir alojamiento" })
    return { user, dialog }
}

describe("PropertiesUnits — el diálogo rediseñado escribe lo mismo de siempre", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getRoomTypes.mockResolvedValue([{ id: 3, name: "Suite" }])
        mocks.getCurrencies.mockResolvedValue([{ id: "COP", name: "COP - Peso colombiano" }, { id: "USD", name: "USD - Dólar" }])
        mocks.createListing.mockResolvedValue({ uuid: "l-new", extra: { startPrice: 250000 } })
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("panel: encabezado y pie fijos, cinco pestañas con nombre completo", async () => {
        const { dialog } = await openNewUnit()
        expect(dialog).toHaveAttribute("data-layout", "panel")
        expect(within(dialog).getAllByRole("tab").map((t) => t.textContent)).toEqual(
            ["General", "Operación", "Distribución", "Políticas", "Automatizaciones"],
        )
        expect(within(dialog).getByRole("button", { name: "Añadir alojamiento" })).toBeInTheDocument()
    })

    it("capacidad con NumberStepper, precio y moneda en MoneyField: el payload de POST /listings no cambia", async () => {
        const { user, dialog } = await openNewUnit()
        await waitFor(() => expect(within(dialog).getByRole("button", { name: "Añadir alojamiento" })).toBeEnabled())

        await user.type(within(dialog).getByLabelText(/Nombre del alojamiento/), "Suite 101")
        await user.click(within(dialog).getByRole("combobox", { name: /Categoría/ }))
        await user.click(await screen.findByRole("option", { name: "Suite" }))

        const capacity = within(dialog).getByRole("spinbutton", { name: /Capacidad máxima/ })
        expect(capacity).toHaveValue("2")
        await user.click(within(dialog).getByRole("button", { name: "Un huésped más" }))
        expect(capacity).toHaveValue("3")

        await user.type(within(dialog).getByLabelText(/Precio inicial por noche/), "250000")
        await user.click(within(dialog).getByRole("combobox", { name: "Moneda" }))
        await user.click(await screen.findByRole("option", { name: "USD - Dólar" }))

        await user.type(within(dialog).getByLabelText(/Correo de contacto/), "suite@mirador.co")
        await user.click(within(dialog).getByRole("button", { name: "Añadir alojamiento" }))

        await waitFor(() => expect(mocks.createListing).toHaveBeenCalledTimes(1))
        const payload = mocks.createListing.mock.calls[0][0]
        expect(payload).toMatchObject({
            propertyUuid: "p-1",
            name: "Suite 101",
            roomTypeId: 3,
            contactEmail: "suite@mirador.co",
            statusRecordId: 6,
        })
        expect(payload.extra).toMatchObject({ startPrice: 250000, currency: "USD", maxOccupancy: 3, bedRoom: 1, bathRoom: 1 })
        // Lo heredado no viaja (igual que antes).
        expect("cancellationPolicy" in payload.extra).toBe(false)
        expect("amenities" in payload.extra).toBe(false)
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Alojamiento creado")
    })

    it("políticas propias: «Estándar» existe como opción (es el valor que viaja por defecto)", async () => {
        const { user, dialog } = await openNewUnit()
        await user.click(within(dialog).getByRole("tab", { name: "Políticas" }))
        await user.click(within(dialog).getByRole("switch", { name: "Heredar políticas de la propiedad" }))
        const select = within(dialog).getByRole("combobox", { name: /Política de cancelación/ })
        expect(select).toHaveTextContent("Estándar")
        await user.click(select)
        expect(await screen.findByRole("option", { name: "Estándar" })).toBeInTheDocument()
        expect(screen.getByRole("option", { name: "No reembolsable" })).toBeInTheDocument()
    })

    it("amenidades propias: CheckboxCard escribe ids numéricos", async () => {
        const { user, dialog } = await openNewUnit()
        await user.click(within(dialog).getByRole("tab", { name: "Operación" }))
        await user.click(within(dialog).getByRole("switch", { name: "Heredar amenidades de la propiedad" }))
        const piscina = await within(dialog).findByRole("checkbox", { name: "Piscina" })
        await user.click(within(dialog).getByText("Piscina"))
        expect(piscina).toBeChecked()
    })

    it("categorías caídas: aviso con «Reintentar» junto al campo, y el guardado espera", async () => {
        mocks.getRoomTypes.mockRejectedValueOnce(new Error("500"))
        const { user, dialog } = await openNewUnit()
        expect(await within(dialog).findByText(/No pudimos cargar las categorías/)).toBeInTheDocument()
        expect(within(dialog).getByRole("button", { name: "Añadir alojamiento" })).toBeDisabled()
        // Mientras reintenta, el aviso sigue y dice que está en ello (no desaparece y vuelve).
        let release!: (v: unknown[]) => void
        mocks.getRoomTypes.mockReturnValueOnce(new Promise<unknown[]>((done) => { release = done }))
        await user.click(within(dialog).getByRole("button", { name: "Reintentar" }))
        expect(within(dialog).getByText("Reintentando…")).toBeInTheDocument()
        release([{ id: 3, name: "Suite" }])
        await waitFor(() => expect(within(dialog).queryByText(/No pudimos cargar las categorías/)).toBeNull())
        expect(mocks.getRoomTypes).toHaveBeenCalledTimes(2)
        expect(within(dialog).getByRole("button", { name: "Añadir alojamiento" })).toBeEnabled()
    })

    it("teclado: el foco entra al diálogo, Tab recorre interruptor, pestañas y campos, y Escape cierra", async () => {
        const { user, dialog } = await openNewUnit()
        await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
        const active = within(dialog).getByRole("switch", { name: "Alojamiento activo" })
        active.focus()
        await user.tab()
        expect(within(dialog).getByRole("tab", { name: "General" })).toHaveFocus()
        await user.keyboard("{ArrowRight}")
        expect(within(dialog).getByRole("tab", { name: "Operación" })).toHaveFocus()
        expect(within(dialog).getByRole("switch", { name: "Heredar horarios de la propiedad" })).toBeInTheDocument()
        await user.keyboard("{ArrowLeft}")
        await user.tab()
        expect(within(dialog).getByRole("tabpanel")).toHaveFocus()
        await user.tab()
        expect(within(dialog).getByLabelText(/Nombre del alojamiento/)).toHaveFocus()
        await user.tab()
        expect(within(dialog).getByLabelText(/Nombre interno o número/)).toHaveFocus()
        await user.keyboard("{Escape}")
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        // El foco vuelve al disparador (Radix lo restaura al cerrar, en el siguiente tick).
        await waitFor(() => expect(screen.getByRole("button", { name: "Añadir alojamiento" })).toHaveFocus())
    })

    it("la fila de la tabla nombra sus acciones", () => {
        render(<Wrapper units={[{ uuid: "l-1", name: "Suite 101", internalName: "101", isActive: true }]}><PropertiesUnits /></Wrapper>)
        expect(screen.getByRole("button", { name: "Editar Suite 101" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Eliminar Suite 101" })).toBeInTheDocument()
    })
})
