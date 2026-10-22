import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AutomationOverrideModal } from "./AutomationOverrideModal"
import { ApiError } from "@/types/api"
import { resetIdentityProviderCatalogCache } from "../../hooks/useIdentityProviderCatalog"
import { AUTOMATION_STATUS, type ListingAutomationOverride, type PropertyAutomation, type Provider } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    createListingOverride: vi.fn(),
    updateListingOverride: vi.fn(),
    deleteListingOverride: vi.fn(),
    listListingOverrides: vi.fn(),
    listProviders: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return {
        ...actual,
        automationService: {
            createListingOverride: mocks.createListingOverride,
            updateListingOverride: mocks.updateListingOverride,
            deleteListingOverride: mocks.deleteListingOverride,
            listListingOverrides: mocks.listListingOverrides,
            listProviders: mocks.listProviders,
        },
    }
})
vi.mock("sonner", () => ({ toast: mocks.toast }))

function provider(id: number, slug: string, verification_type?: string): Provider {
    return {
        id, name: slug, description: null, order: 0, statusProviderId: 8,
        parameters: { slug, ...(verification_type ? { verification_type } : {}) },
    }
}

/** Ids arbitrarios a propósito: ninguno es 1000/1004, nada se resuelve por id fijo. */
const ADVANCED = provider(501, "didit", "session")
const ESSENTIAL = provider(502, "textract", "document_upload")

/** Reporte PDF: automatización con parámetros por unidad, NO de identidad. */
const PDF: PropertyAutomation = {
    uuid: "pdf-row",
    propertyUuid: "property-1",
    providerId: 1003,
    providerName: "pdf_report",
    provider: provider(1003, "pdf_report"),
    name: "Guest Report PDF",
    guestType: "all",
    executionOrder: 30,
    parameters: { recipients: ["ops@x.com"] },
    token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE,
    deletedAt: null,
    isActive: true,
}

/** Verificación principal de la propiedad: activa con Avanzada. */
const IDENTITY: PropertyAutomation = {
    uuid: "identity-main",
    propertyUuid: "property-1",
    providerId: 501,
    providerName: "didit",
    provider: ADVANCED,
    automationType: "identity_verification",
    name: "Identity Verification - Main Guest",
    guestType: "main_guest",
    executionOrder: 1,
    parameters: {},
    token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE,
    deletedAt: null,
    isActive: true,
}

function override(over: Partial<ListingAutomationOverride> = {}): ListingAutomationOverride {
    return {
        uuid: "ov-1",
        listingUuid: "unit-1",
        propertyAutomationUuid: "identity-main",
        parameters: null,
        token: null,
        statusRecordId: 6,
        deletedAt: null,
        isActive: true,
        ...over,
    }
}

function renderModal(props: Partial<Parameters<typeof AutomationOverrideModal>[0]> = {}) {
    const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onInheritRestored: vi.fn() }
    const automation = (props.propertyAutomations?.[0] ?? IDENTITY)
    render(
        <AutomationOverrideModal
            open
            listingUuid="unit-1"
            listingName="Tree House Tipo A"
            propertyAutomations={[automation]}
            lockedPropertyAutomationUuid={automation.uuid}
            override={null}
            {...handlers}
            {...props}
        />,
    )
    return handlers
}

beforeEach(() => {
    vi.clearAllMocks()
    resetIdentityProviderCatalogCache()
    mocks.listProviders.mockResolvedValue([provider(1, "tra_colombia"), ADVANCED, ESSENTIAL])
})

describe("AutomationOverrideModal — automatizaciones que no son de identidad", () => {
    const pdf = { propertyAutomations: [PDF], lockedPropertyAutomationUuid: "pdf-row" }

    it("una unidad que hereda y se guarda sin cambios NO crea un override", async () => {
        const handlers = renderModal(pdf)
        expect(screen.getByText(/Hoy hereda de la propiedad/)).toBeInTheDocument()
        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(handlers.onClose).toHaveBeenCalled()
        expect(mocks.listProviders).not.toHaveBeenCalled()
    })

    it("apagarla en la unidad crea el override inactivo", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "pdf-row", statusRecordId: 7, isActive: false }))
        renderModal(pdf)
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "pdf-row", statusRecordId: 7, parameters: null,
        }))
    })

    it("con override, «Volver a heredar» lo borra y avisa al llamador", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        const handlers = renderModal({ ...pdf, override: override({ propertyAutomationUuid: "pdf-row" }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))
        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
        expect(handlers.onInheritRestored).toHaveBeenCalled()
    })

    it("si el borrado falla, la unidad conserva su override", async () => {
        mocks.deleteListingOverride.mockRejectedValue(new Error("HTTP 500"))
        const handlers = renderModal({ ...pdf, override: override({ propertyAutomationUuid: "pdf-row" }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))
        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
        expect(handlers.onInheritRestored).not.toHaveBeenCalled()
    })

    it("en borrador descarta el override sin llamar al servidor", async () => {
        const handlers = renderModal({ ...pdf, draftMode: true, override: override({ uuid: "", propertyAutomationUuid: "pdf-row" }) })
        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))
        await waitFor(() => expect(handlers.onInheritRestored).toHaveBeenCalled())
        expect(mocks.deleteListingOverride).not.toHaveBeenCalled()
    })
})

describe("AutomationOverrideModal — contrato por unidad (contrato 2026-10-19)", () => {
    const SIGNATURE: Provider = {
        ...provider(1005, "hitguest_signature"),
        parameters: { slug: "hitguest_signature", signature: { synchronous: true, contract_types: ["agreement_only"] } },
    }
    const CONTRACT: PropertyAutomation = {
        ...PDF,
        uuid: "contract-row",
        providerId: 1005,
        providerName: "hitguest_signature",
        provider: SIGNATURE,
        name: "Digital Signature",
        guestType: "main_guest",
        executionOrder: 10,
        parameters: { contract_mode: "all_sources", by_source: { all: { contract_type: "agreement_only", provider_slug: "hitguest_signature" } } },
    }
    const contract = { propertyAutomations: [CONTRACT], lockedPropertyAutomationUuid: "contract-row" }

    it("apagarlo dice que los huéspedes de la unidad no firmarán, y crea el override inactivo", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "contract-row", statusRecordId: 7, isActive: false }))
        renderModal(contract)
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        expect(screen.getByText("Los huéspedes de esta unidad no firmarán contrato.")).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "contract-row", statusRecordId: 7, parameters: null,
        }))
    })

    it("cambiar el estado no pisa un ruteo propio de la unidad: el PATCH no manda `parameters`", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ propertyAutomationUuid: "contract-row", statusRecordId: 7, isActive: false }))
        renderModal({
            ...contract,
            override: override({
                propertyAutomationUuid: "contract-row",
                parameters: { contract_mode: "per_source", by_source: { 22: { contract_type: "agreement_only", provider_slug: "hitguest_signature" } } },
            }),
        })
        expect(screen.getByText("Esta unidad tiene su propio contrato por canal.")).toBeInTheDocument()
        const user = userEvent.setup()
        await user.click(screen.getByRole("switch"))
        await user.click(screen.getByRole("button", { name: "Guardar" }))
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-1", { statusRecordId: 7 }))
    })
})

describe("AutomationOverrideModal — identidad por unidad (contrato 2026-10-14)", () => {
    async function choose(label: RegExp) {
        const user = userEvent.setup()
        const option = await screen.findByRole("radio", { name: label })
        await waitFor(() => expect(option).toBeEnabled())
        await user.click(option)
        await user.click(screen.getByRole("button", { name: "Guardar" }))
    }

    it("muestra las cuatro opciones, sin interruptor, y Heredar dice qué usa la propiedad", async () => {
        renderModal()
        for (const name of [/Heredar/, /Verificación avanzada/, /Verificación esencial/, /Desactivar/]) {
            expect(await screen.findByRole("radio", { name })).toBeInTheDocument()
        }
        expect(screen.queryByRole("switch")).toBeNull()
        expect(screen.getByRole("radio", { name: /Heredar/ })).toBeChecked()
        expect(screen.getByText(/verificación avanzada\./)).toBeInTheDocument()
    })

    it("sin override, Esencial crea el override con el id del CATÁLOGO", async () => {
        mocks.createListingOverride.mockResolvedValue(override({ providerId: 502, providerSource: "listing" }))
        const handlers = renderModal()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "identity-main", statusRecordId: 6, providerId: 502,
        }))
        expect(handlers.onSaved).toHaveBeenCalled()
    })

    it("de Avanzada propia a Esencial: PATCH solo con el proveedor", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ providerId: 502, providerSource: "listing" }))
        renderModal({ override: override({ providerId: 501, providerSource: "listing", effectiveProvider: { id: 501, name: "didit", slug: "didit", verificationType: "session" } }) })
        expect(await screen.findByRole("radio", { name: /Verificación avanzada/ })).toBeChecked()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-1", { providerId: 502 }))
    })

    it("de Desactivada a Esencial: DELETE y luego POST (el POST revive la fila)", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        mocks.createListingOverride.mockResolvedValue(override({ providerId: 502, providerSource: "listing" }))
        renderModal({ override: override({ statusRecordId: 7, isActive: false, providerSource: null }) })
        expect(await screen.findByRole("radio", { name: /Desactivar/ })).toBeChecked()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalled())
        expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1")
        expect(mocks.deleteListingOverride.mock.invocationCallOrder[0]).toBeLessThan(mocks.createListingOverride.mock.invocationCallOrder[0])
    })

    it("Desactivar sobre un override activo: PATCH con 7 y SIN proveedor", async () => {
        mocks.updateListingOverride.mockResolvedValue(override({ statusRecordId: 7, isActive: false, providerSource: null }))
        renderModal({ override: override({ providerId: 501, providerSource: "listing", effectiveProvider: { id: 501, name: null, slug: "didit", verificationType: "session" } }) })
        await choose(/Desactivar/)
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-1", { statusRecordId: 7 }))
    })

    it("Heredar con override: DELETE y la unidad vuelve a heredar", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        const handlers = renderModal({ override: override({ statusRecordId: 7, isActive: false, providerSource: null }) })
        await choose(/Heredar/)
        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
        expect(handlers.onInheritRestored).toHaveBeenCalled()
    })

    it("propiedad con la verificación apagada: Avanzada y Esencial deshabilitadas", async () => {
        renderModal({ propertyAutomations: [{ ...IDENTITY, isActive: false, statusProviderId: AUTOMATION_STATUS.INACTIVE }] })
        expect(await screen.findByRole("radio", { name: /Verificación avanzada/ })).toBeDisabled()
        expect(screen.getByRole("radio", { name: /Verificación esencial/ })).toBeDisabled()
        expect(screen.getAllByText(/la unidad no puede encender un nivel/).length).toBeGreaterThan(0)
        expect(screen.getByText(/solo suben fotos del documento\./)).toBeInTheDocument()
    })

    it("si el catálogo no carga, no se puede elegir un nivel y se ofrece Reintentar", async () => {
        mocks.listProviders.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([ADVANCED, ESSENTIAL])
        vi.spyOn(console, "error").mockImplementation(() => {})
        renderModal()
        const retry = await screen.findByRole("button", { name: /Reintentar/ })
        expect(screen.getByRole("radio", { name: /Verificación esencial/ })).toBeDisabled()
        await userEvent.setup().click(retry)
        await waitFor(() => expect(screen.getByRole("radio", { name: /Verificación esencial/ })).toBeEnabled())
    })

    it("un 422 en provider_id aparece junto al selector, tal cual", async () => {
        mocks.createListingOverride.mockRejectedValue(new ApiError(422, {
            message: "x", errors: { provider_id: ["El proveedor no aplica al país de la propiedad."] },
        }))
        renderModal()
        await choose(/Verificación esencial/)
        expect(await screen.findByText("El proveedor no aplica al país de la propiedad.")).toHaveAttribute("id", "identity-override-error")
    })

    it("un 422 por override duplicado relee los de la unidad y actualiza el existente", async () => {
        mocks.createListingOverride.mockRejectedValue(new ApiError(422, {
            message: "x", errors: { property_automation_uuid: ["Ya existe un override para esta unidad."] },
        }))
        mocks.listListingOverrides.mockResolvedValue([override({ uuid: "ov-existente", providerSource: "property" })])
        mocks.updateListingOverride.mockResolvedValue(override({ uuid: "ov-existente", providerId: 502, providerSource: "listing" }))
        const handlers = renderModal()
        await choose(/Verificación esencial/)
        await waitFor(() => expect(mocks.updateListingOverride).toHaveBeenCalledWith("ov-existente", { providerId: 502 }))
        expect(mocks.listListingOverrides).toHaveBeenCalledWith("unit-1")
        expect(handlers.onSaved).toHaveBeenCalled()
    })

    it("en borrador, Esencial guarda el proveedor elegido sin llamar al servidor", async () => {
        const handlers = renderModal({ draftMode: true, listingUuid: "" })
        await choose(/Verificación esencial/)
        await waitFor(() => expect(handlers.onSaved).toHaveBeenCalledWith(expect.objectContaining({
            providerId: 502, providerSource: "listing", statusRecordId: 6,
        })))
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
    })

    it("sin cambios no llama al servidor", async () => {
        const handlers = renderModal()
        await choose(/Heredar/)
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(mocks.deleteListingOverride).not.toHaveBeenCalled()
        expect(handlers.onClose).toHaveBeenCalled()
    })
})
