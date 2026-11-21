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
import { apiResponseToFormData } from "../types"

function Wrapper({ children, units }: { children: ReactNode; units: unknown[] }) {
    const form = useForm({ defaultValues: { uuid: "p-1", statusRecordId: 6, units } })
    return <FormProvider {...form}>{children}</FormProvider>
}

/** Filas tal como llegan del GET (`statusRecord`, `extra`, `pmsIdentifiers`), sin `isActive`. */
const FROM_API = [
    { uuid: "l-1", name: "Suite 101", internalName: "101", statusRecord: { id: 6 }, price: 0, extra: { maxOccupancy: 0 }, pmsIdentifiers: [] },
    { uuid: "l-2", name: "Casa Grande", internalName: "", statusRecord: { id: 7 }, extra: { maxOccupancy: 16, bathRoom: 5, startPrice: 500, currency: "USD" },
        pmsIdentifiers: [{ id: 3, sourcePmsId: 134, sourcePms: "KunasPMS", externalId: "26118" }] },
]

describe("PropertiesUnits — la tabla usa las columnas de la pestaña Alojamientos", () => {
    beforeEach(() => vi.clearAllMocks())

    it("sin capacidad ni precio dice «sin declarar» y «—» (antes «0 huéspedes» y «$0»); el estado sale del backend, no se asume activo", async () => {
        render(<Wrapper units={FROM_API}><PropertiesUnits /></Wrapper>)
        const table = await screen.findByRole("table")
        expect(within(table).queryByText(/0 huéspedes|\$0/)).toBeNull()
        const [suite, casa] = within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row")
        expect(within(suite).getByRole("button", { name: "Capacidad: sin declarar" })).toBeDisabled()
        expect(suite).toHaveTextContent("—")
        expect(suite).toHaveTextContent("Activo")
        expect(suite).toHaveTextContent("Sin vincular")
        // Inactiva en el backend: antes la tabla la pintaba «Activo» porque no traía `isActive`.
        expect(casa).toHaveTextContent("Inactivo")
        // Una sola celda: huéspedes a la vista; habitaciones y baños, en su nombre y su detalle.
        expect(within(casa).getByRole("button", { name: /^Capacidad: Hasta 16 huéspedes, .*5 baños$/ })).toHaveTextContent(/^16$/)
        expect(casa).toHaveTextContent("US$")
        expect(within(casa).getByRole("button", { name: /KunasPMS/ })).toBeInTheDocument()
        // Sin columna Propiedad: ya se está dentro de la propiedad.
        expect(within(table).queryByRole("columnheader", { name: /Propiedad/ })).toBeNull()
    })

    it("una fila aún sin guardar usa el estado del formulario y nombra el origen por su id si no trae nombre", async () => {
        const draft = { name: "Borrador", internalName: "B1", isActive: false, extra: {}, externalPmsIds: [{ sourcePmsId: 134, externalId: "9" }] }
        render(<Wrapper units={[draft]}><PropertiesUnits /></Wrapper>)
        const table = await screen.findByRole("table")
        const [row] = within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row")
        expect(row).toHaveTextContent("Inactivo")
        expect(row).toHaveTextContent("Origen #134")
    })
})

describe("PropertiesUnits — la capacidad es la que declara el backend, no la del formulario", () => {
    it("un alojamiento sin capacidad declarada dice «sin declarar» aunque el formulario la rellene con 2/1/1", async () => {
        // El camino real: la respuesta de la propiedad pasa por `apiResponseToFormData`.
        const form = apiResponseToFormData({ uuid: "p-1", name: "Nomad", extra: {}, listings: [
            { uuid: "l-9", name: "Kunas sin datos", propertyUuid: "p-1", statusRecord: { id: 6 }, extra: {} },
        ] } as never)
        const units = (form as unknown as { units: { uuid: string; extra: { maxOccupancy: number } }[] }).units
        expect(units.find((u) => u.uuid === "l-9")?.extra.maxOccupancy).toBe(2)
        render(<Wrapper units={units}><PropertiesUnits /></Wrapper>)
        const table = await screen.findByRole("table")
        expect(within(table).getByRole("button", { name: "Capacidad: sin declarar" })).toBeDisabled()
    })
})
