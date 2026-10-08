import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ListingOverridesPanel } from "./ListingOverridesPanel"
import type { ListingAutomationOverride, PropertyAutomation } from "../../types/automation"

const mocks = vi.hoisted(() => ({ listListingOverrides: vi.fn() }))

vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return { ...actual, automationService: { listListingOverrides: mocks.listListingOverrides } }
})
vi.mock("./AutomationOverrideModal", () => ({
    AutomationOverrideModal: () => <div data-testid="override-modal" />,
}))

const automation: PropertyAutomation = {
    uuid: "identity-main",
    propertyUuid: "property",
    providerId: 1000,
    name: "Verificación de Identidad (Principal)",
    guestType: "main_guest",
    executionOrder: 1,
    parameters: {},
    token: null,
    statusProviderId: 8,
    deletedAt: null,
    isActive: true,
    provider: null,
    providerName: "didit",
}

const disabledOverride: ListingAutomationOverride = {
    uuid: "ov-1",
    listingUuid: "unit-1",
    propertyAutomationUuid: "identity-main",
    parameters: null,
    token: null,
    statusRecordId: 7,
    deletedAt: null,
    isActive: false,
}

const listings = [
    { uuid: "unit-1", name: "Unidad 1", internalName: null },
    { uuid: "unit-2", name: "Unidad 2", internalName: null },
]

describe("ListingOverridesPanel — caída parcial al cargar overrides", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listListingOverrides.mockImplementation((listingUuid: string) =>
            listingUuid === "unit-1"
                ? Promise.resolve([disabledOverride])
                : Promise.reject(new Error("network")),
        )
    })

    it("una unidad fallida se marca, no queda clicable y se puede reintentar sola", async () => {
        render(<ListingOverridesPanel automation={automation} listings={listings} />)
        fireEvent.click(screen.getByRole("button", { name: /Overrides por unidad/ }))

        // La que cargó muestra su estado real (identidad desactivada por listing).
        expect(await screen.findByText("Desactivada en esta unidad")).toBeInTheDocument()
        // La que falló lo dice y no ofrece abrir el modal con un override inventado.
        expect(await screen.findByText("No se pudo cargar")).toBeInTheDocument()
        expect(screen.getByText(/No se pudo cargar la configuración de una unidad/)).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Unidad 2/ })).toBeNull()

        // Reintento por fila: ahora responde.
        mocks.listListingOverrides.mockResolvedValue([])
        fireEvent.click(screen.getAllByRole("button", { name: /Reintentar/ }).at(-1)!)
        await waitFor(() => expect(screen.queryByText("No se pudo cargar")).toBeNull())
        expect(screen.getByText("Hereda de la propiedad")).toBeInTheDocument()
        expect(mocks.listListingOverrides).toHaveBeenLastCalledWith("unit-2")
    })

    it("abrir una unidad cargada pasa su override real al modal", async () => {
        render(<ListingOverridesPanel automation={automation} listings={listings} />)
        fireEvent.click(screen.getByRole("button", { name: /Overrides por unidad/ }))
        const row = await screen.findByRole("button", { name: /Unidad 1/ })
        await waitFor(() => expect(row).toBeEnabled())
        fireEvent.click(row)
        expect(screen.getByTestId("override-modal")).toBeInTheDocument()
    })
})
