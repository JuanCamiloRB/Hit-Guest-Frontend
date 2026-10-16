import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ListingOverridesPanel } from "./ListingOverridesPanel"
import type { ListingAutomationOverride, PropertyAutomation } from "../../types/automation"
import { resetIdentityProviderCatalogCache } from "../../hooks/useIdentityProviderCatalog"

const mocks = vi.hoisted(() => ({ listListingOverrides: vi.fn(), listProviders: vi.fn() }))

vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return { ...actual, automationService: { listListingOverrides: mocks.listListingOverrides, listProviders: mocks.listProviders } }
})
vi.mock("./AutomationOverrideModal", () => ({
    // El modal tiene sus propios tests; acá solo se expone su salida de «heredar».
    AutomationOverrideModal: ({ onInheritRestored }: { onInheritRestored: () => void }) => (
        <div data-testid="override-modal">
            <button type="button" onClick={onInheritRestored}>simular volver a heredar</button>
        </div>
    ),
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
        expect(screen.getByText("Hereda de la propiedad (verificación avanzada)")).toBeInTheDocument()
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

/** TRA: no es identidad, así que conserva la lectura por parámetros. */
const tra: PropertyAutomation = { ...automation, uuid: "tra-row", providerId: 1, providerName: "tra_colombia", name: "TRA Colombia", guestType: "all", executionOrder: 40 }

describe("ListingOverridesPanel — un override activo no se presenta como herencia (no identidad)", () => {
    const activeOverride: ListingAutomationOverride = { ...disabledOverride, propertyAutomationUuid: "tra-row", statusRecordId: 6, isActive: true }

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listListingOverrides.mockImplementation((listingUuid: string) =>
            Promise.resolve(listingUuid === "unit-1" ? [activeOverride] : []))
    })

    it("distingue el override activo sin parámetros de la unidad que hereda", async () => {
        render(<ListingOverridesPanel automation={tra} listings={listings} />)
        fireEvent.click(screen.getByRole("button", { name: /Overrides por unidad/ }))

        expect(await screen.findByText("Override activo sin parámetros propios")).toBeInTheDocument()
        expect(screen.getAllByText("Hereda de la propiedad")).toHaveLength(1)
        expect(screen.getByText("1 configurada")).toBeInTheDocument()
        expect(mocks.listProviders).not.toHaveBeenCalled()
    })

    it("al volver a heredar, la fila pasa a «Hereda de la propiedad»", async () => {
        render(<ListingOverridesPanel automation={tra} listings={listings} />)
        fireEvent.click(screen.getByRole("button", { name: /Overrides por unidad/ }))
        const row = await screen.findByRole("button", { name: /Unidad 1/ })
        await waitFor(() => expect(row).toBeEnabled())
        fireEvent.click(row)

        fireEvent.click(screen.getByRole("button", { name: "simular volver a heredar" }))

        await waitFor(() => expect(screen.getAllByText("Hereda de la propiedad")).toHaveLength(2))
        expect(screen.getByText("Todas heredan de la propiedad")).toBeInTheDocument()
    })
})

describe("ListingOverridesPanel — identidad por unidad (contrato 2026-10-14)", () => {
    const listingsAll = [...listings, { uuid: "unit-3", name: "Unidad 3", internalName: null }, { uuid: "unit-4", name: "Unidad 4", internalName: null }]
    const byListing: Record<string, ListingAutomationOverride[]> = {
        // 6 + `property`: hereda aunque haya fila (antes se leía como «override activo»).
        "unit-1": [{ ...disabledOverride, statusRecordId: 6, isActive: true, providerSource: "property", token: "legacy-token" }],
        // 6 + `listing` + document_upload: Esencial propia.
        "unit-2": [{ ...disabledOverride, uuid: "ov-2", listingUuid: "unit-2", statusRecordId: 6, isActive: true, providerId: 502, providerSource: "listing",
            effectiveProvider: { id: 502, name: "HitGuest Essential Verification", slug: "textract", verificationType: "document_upload" } }],
        // 7: desactivada.
        "unit-3": [{ ...disabledOverride, uuid: "ov-3", listingUuid: "unit-3", providerSource: null }],
        "unit-4": [],
    }

    beforeEach(() => {
        vi.clearAllMocks()
        resetIdentityProviderCatalogCache()
        mocks.listProviders.mockResolvedValue([])
        mocks.listListingOverrides.mockImplementation((listingUuid: string) => Promise.resolve(byListing[listingUuid] ?? []))
    })

    it("pinta cada unidad con la tabla del contrato, no por parámetros ni token", async () => {
        render(<ListingOverridesPanel automation={automation} listings={listingsAll} />)
        fireEvent.click(screen.getByRole("button", { name: /Overrides por unidad/ }))

        const row = async (name: RegExp) => screen.findByRole("button", { name })
        expect(await row(/Unidad 1/)).toHaveTextContent("Hereda de la propiedad (verificación avanzada)")
        expect(await row(/Unidad 2/)).toHaveTextContent("Verificación esencial en esta unidad")
        expect(await row(/Unidad 3/)).toHaveTextContent("Desactivada en esta unidad")
        expect(await row(/Unidad 4/)).toHaveTextContent("Hereda de la propiedad (verificación avanzada)")
        // El token de identidad no aplica: ni el heredado viejo se muestra.
        expect(screen.queryByText("token")).toBeNull()
        // Las que heredan no cuentan como configuradas.
        expect(screen.getByText("2 configuradas")).toBeInTheDocument()
    })

    it("con la propiedad apagada, heredar es «sin verificación»", async () => {
        render(<ListingOverridesPanel automation={{ ...automation, isActive: false, statusProviderId: 10 }} listings={[listingsAll[3]]} />)
        fireEvent.click(screen.getByRole("button", { name: /Overrides por unidad/ }))
        expect(await screen.findByRole("button", { name: /Unidad 4/ })).toHaveTextContent("Hereda de la propiedad (sin verificación)")
    })
})
