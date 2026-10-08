import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"
import { CheckinLinkDeliveryOverrides } from "./CheckinLinkDeliveryOverrides"
import type { ListingAutomationOverride, PropertyAutomation } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    listListingOverrides: vi.fn(),
    createListingOverride: vi.fn(),
    updateListingOverride: vi.fn(),
    deleteListingOverride: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return { ...actual, automationService: mocks }
})

const automation: PropertyAutomation = {
    uuid: "delivery", propertyUuid: "property", providerId: 42, name: "Check-in Link Delivery",
    guestType: "all", executionOrder: 7, parameters: { channels: ["email", "whatsapp"] }, token: null,
    statusProviderId: 8, deletedAt: null, isActive: true, provider: null, providerName: "whatsapp_checkin_link",
}
const listings = [{ uuid: "unit-1", name: "Unidad 1", internalName: null }]

function override(channels: string[]): ListingAutomationOverride {
    return {
        uuid: "ov-1", listingUuid: "unit-1", propertyAutomationUuid: "delivery",
        parameters: { channels }, token: null, statusRecordId: 6, deletedAt: null, isActive: true,
    }
}

async function openPanel(pmsConnected = true) {
    render(<CheckinLinkDeliveryOverrides automation={automation} listings={listings} pmsConnected={pmsConnected} />)
    fireEvent.click(screen.getByRole("button", { name: /Por unidad/ }))
    return screen.findByRole("radio", { name: "Usar la configuración de la propiedad" })
}

describe("CheckinLinkDeliveryOverrides — heredar o conjunto propio (§5 + §13.4)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listListingOverrides.mockResolvedValue([])
    })

    it("una unidad que hereda puede fijar su propio conjunto con OTA", async () => {
        mocks.createListingOverride.mockResolvedValue(override(["email", "ota_inbox"]))
        const inherit = await openPanel()
        expect(inherit).toBeChecked()
        expect(screen.getByText("Propiedad: Email y WhatsApp")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("radio", { name: "Configurar distinto para esta unidad" }))
        fireEvent.click(screen.getByRole("checkbox", { name: "Mensaje en la OTA en Unidad 1" }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        await waitFor(() => expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1",
            propertyAutomationUuid: "delivery",
            statusRecordId: 6,
            parameters: { channels: ["email", "ota_inbox"] },
        }))
    })

    it("volver a heredar borra el override", async () => {
        mocks.listListingOverrides.mockResolvedValue([override(["email"])])
        await openPanel()
        expect(screen.getByRole("radio", { name: "Configurar distinto para esta unidad" })).toBeChecked()

        fireEvent.click(screen.getByRole("radio", { name: "Usar la configuración de la propiedad" }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        await waitFor(() => expect(mocks.deleteListingOverride).toHaveBeenCalledWith("ov-1"))
    })

    it("sin PMS la casilla de OTA no se ofrece, salvo que la unidad ya la tenga", async () => {
        mocks.listListingOverrides.mockResolvedValue([override(["email", "ota_inbox"])])
        await openPanel(false)
        expect(screen.getByRole("checkbox", { name: "Mensaje en la OTA en Unidad 1" })).toBeChecked()
    })

    it("pasar el borrador por «heredar» y volver no pierde la OTA guardada", async () => {
        // Sin pista de PMS: la visibilidad de la casilla depende de lo guardado.
        mocks.listListingOverrides.mockResolvedValue([override(["email", "ota_inbox"])])
        await openPanel(false)

        fireEvent.click(screen.getByRole("radio", { name: "Usar la configuración de la propiedad" }))
        fireEvent.click(screen.getByRole("radio", { name: "Configurar distinto para esta unidad" }))

        // La casilla sigue visible y marcada (se restauró lo persistido)…
        expect(screen.getByRole("checkbox", { name: "Mensaje en la OTA en Unidad 1" })).toBeChecked()
        // …y como el borrador volvió a lo guardado, no hay nada que guardar.
        expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument()
    })

    it("el 422 de canales se muestra en la fila", async () => {
        const message = "El canal de mensaje de OTA requiere que la propiedad esté conectada a KunasPMS o Calry."
        mocks.createListingOverride.mockRejectedValue(new ApiError(422, {
            message: "Datos inválidos",
            errors: { "parameters.channels": [message] },
        }))
        await openPanel()
        fireEvent.click(screen.getByRole("radio", { name: "Configurar distinto para esta unidad" }))
        fireEvent.click(screen.getByRole("checkbox", { name: "Mensaje en la OTA en Unidad 1" }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        expect(await screen.findByRole("alert")).toHaveTextContent(message)
    })
})
