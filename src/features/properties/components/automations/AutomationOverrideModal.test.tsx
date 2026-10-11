import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AutomationOverrideModal } from "./AutomationOverrideModal"
import { AUTOMATION_STATUS, type ListingAutomationOverride, type PropertyAutomation } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    createListingOverride: vi.fn(),
    updateListingOverride: vi.fn(),
    deleteListingOverride: vi.fn(),
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
        },
    }
})
vi.mock("sonner", () => ({ toast: mocks.toast }))

/** Verificación principal: sin parámetros por unidad, solo se puede apagar. */
const IDENTITY: PropertyAutomation = {
    uuid: "identity-main",
    propertyUuid: "property-1",
    providerId: 1000,
    providerName: "didit",
    name: "Identity Verification - Main Guest",
    guestType: "main_guest",
    executionOrder: 1,
    parameters: {},
    token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE,
    deletedAt: null,
    isActive: true,
}

const ACTIVE_OVERRIDE: ListingAutomationOverride = {
    uuid: "ov-1",
    listingUuid: "unit-1",
    propertyAutomationUuid: "identity-main",
    parameters: null,
    token: null,
    statusRecordId: 6,
    deletedAt: null,
    isActive: true,
}

function renderModal(props: Partial<Parameters<typeof AutomationOverrideModal>[0]> = {}) {
    const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onInheritRestored: vi.fn() }
    render(
        <AutomationOverrideModal
            open
            listingUuid="unit-1"
            listingName="Tree House Tipo A"
            propertyAutomations={[IDENTITY]}
            lockedPropertyAutomationUuid="identity-main"
            override={null}
            {...handlers}
            {...props}
        />,
    )
    return handlers
}

describe("AutomationOverrideModal — heredar no es lo mismo que un override activo", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("una unidad que hereda y se guarda sin cambios NO crea un override", async () => {
        const handlers = renderModal()
        expect(screen.getByText(/Hoy hereda de la propiedad/)).toBeInTheDocument()

        await userEvent.setup().click(screen.getByRole("button", { name: "Guardar" }))

        expect(mocks.createListingOverride).not.toHaveBeenCalled()
        expect(handlers.onSaved).not.toHaveBeenCalled()
        expect(handlers.onClose).toHaveBeenCalled()
        expect(mocks.toast.info).toHaveBeenCalledWith("Sin cambios: la unidad sigue heredando de la propiedad.")
    })

    it("apagarla en la unidad sí crea el override inactivo", async () => {
        const created = { ...ACTIVE_OVERRIDE, statusRecordId: 7 as const, isActive: false }
        mocks.createListingOverride.mockResolvedValue(created)
        const handlers = renderModal()
        const user = userEvent.setup()

        await user.click(screen.getByRole("switch"))
        await user.click(screen.getByRole("button", { name: "Guardar" }))

        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1",
            propertyAutomationUuid: "identity-main",
            statusRecordId: 7,
            parameters: null,
        }))
        expect(handlers.onSaved).toHaveBeenCalledWith(created)
    })

    it("sin override no ofrece «Volver a heredar»: ya hereda", () => {
        renderModal()
        expect(screen.queryByRole("button", { name: "Volver a heredar" })).not.toBeInTheDocument()
    })

    it("con override, «Volver a heredar» lo borra y avisa al llamador", async () => {
        mocks.deleteListingOverride.mockResolvedValue(undefined)
        const handlers = renderModal({ override: ACTIVE_OVERRIDE })

        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))

        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
        expect(handlers.onInheritRestored).toHaveBeenCalled()
        expect(handlers.onSaved).not.toHaveBeenCalled()
    })

    it("si el borrado falla, la unidad conserva su override", async () => {
        mocks.deleteListingOverride.mockRejectedValue(new Error("HTTP 500"))
        const handlers = renderModal({ override: ACTIVE_OVERRIDE })

        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
        expect(handlers.onInheritRestored).not.toHaveBeenCalled()
        expect(handlers.onClose).not.toHaveBeenCalled()
    })

    it("en borrador (unidad sin guardar) descarta el override sin llamar al servidor", async () => {
        const handlers = renderModal({ draftMode: true, override: { ...ACTIVE_OVERRIDE, uuid: "" } })

        await userEvent.setup().click(screen.getByRole("button", { name: "Volver a heredar" }))

        await waitFor(() => expect(handlers.onInheritRestored).toHaveBeenCalled())
        expect(mocks.deleteListingOverride).not.toHaveBeenCalled()
    })
})
