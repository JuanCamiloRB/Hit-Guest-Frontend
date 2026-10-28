import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getRoomTypes: async () => [], getCurrencies: async () => [], getAmenities: async () => [], getPmsSources: async () => [] },
}))
vi.mock("../services/listings-service", () => ({ listingsService: {} }))
vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return { ...actual, automationService: { listGlobal: async () => [], listListingOverrides: async () => [] } }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { PropertiesUnits } from "./PropertiesUnits"

function Wrapper({ children, statusRecordId }: { children: ReactNode; statusRecordId: number }) {
    const form = useForm({ defaultValues: { uuid: "p-1", statusRecordId, units: [] } })
    return <FormProvider {...form}>{children}</FormProvider>
}

async function openNewUnit(statusRecordId: number) {
    render(<Wrapper statusRecordId={statusRecordId}><PropertiesUnits /></Wrapper>)
    await userEvent.setup().click(screen.getByRole("button", { name: /Añadir Unidad/ }))
    return screen.getByRole("switch", { name: "Alojamiento activo" })
}

describe("PropertiesUnits — alojamientos bajo una propiedad inactiva (contrato 2026-10-27 §2.2)", () => {
    it("con la propiedad inactiva, una unidad nueva nace inactiva y no se puede activar, y lo explica", async () => {
        const toggle = await openNewUnit(7)
        expect(toggle).not.toBeChecked()
        expect(toggle).toBeDisabled()
        expect(screen.getByText("La propiedad está inactiva: actívala para poder activar este alojamiento.")).toBeInTheDocument()
    })

    it("con la propiedad activa, todo como siempre", async () => {
        const toggle = await openNewUnit(6)
        expect(toggle).toBeChecked()
        expect(toggle).toBeEnabled()
    })
})
