import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"
import { CheckinLinkDeliveryCard } from "./CheckinLinkDeliveryCard"
import type { PropertyAutomation, Provider } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    configure: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError, info: vi.fn() } }))
vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return { ...actual, automationService: { create: mocks.create, configure: mocks.configure } }
})

const whatsappProvider: Provider = {
    id: 42, name: "WhatsApp Check-in Link", description: null, order: 7, statusProviderId: 8,
    parameters: { slug: "whatsapp_checkin_link", billing: { billable: true, unit_cost: 0 } },
}
const otaProvider: Provider = {
    id: 43, name: "OTA Inbox Check-in Link", description: null, automationType: null, order: 8, statusProviderId: 8,
    parameters: { slug: "ota_inbox_checkin_link", billing: { billable: true, unit_cost: 0.0625 } },
}

function automationWith(channels: string[]): PropertyAutomation {
    return {
        uuid: "delivery", propertyUuid: "property", providerId: 42, name: "Check-in Link Delivery",
        guestType: "all", executionOrder: 7, parameters: { channels }, token: null,
        statusProviderId: 8, deletedAt: null, isActive: true, provider: null,
        providerName: "whatsapp_checkin_link", automationType: "checkin_link_delivery",
    }
}

function renderCard(props: { automation: PropertyAutomation | null; pmsConnected: boolean }) {
    return render(
        <CheckinLinkDeliveryCard
            propertyUuid="property"
            automation={props.automation}
            providers={{ whatsapp: whatsappProvider, ota_inbox: otaProvider }}
            pmsConnected={props.pmsConnected}
            existingAutomations={props.automation ? [props.automation] : []}
            listings={[]}
            onChanged={vi.fn()}
        />,
    )
}

describe("CheckinLinkDeliveryCard — canal «mensaje en la OTA» (contrato 2026-09-27)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.configure.mockImplementation((_uuid: string, payload: { parameters: { channels: string[] } }) =>
            Promise.resolve(automationWith(payload.parameters.channels)))
    })

    it("sin PMS y sin OTA guardado, la casilla de OTA no se ofrece", () => {
        renderCard({ automation: automationWith(["email"]), pmsConnected: false })
        expect(screen.getByRole("checkbox", { name: /WhatsApp/ })).toBeInTheDocument()
        expect(screen.queryByRole("checkbox", { name: /Mensaje en la OTA/ })).toBeNull()
    })

    it("con PMS se ofrece con la tarifa de SU provider y guarda los tres canales en orden", async () => {
        renderCard({ automation: automationWith(["email"]), pmsConnected: true })
        const ota = screen.getByRole("checkbox", { name: /Mensaje en la OTA/ })
        expect(ota).toHaveAccessibleName(/0,0625 USD por mensaje/)
        expect(screen.getByRole("checkbox", { name: /WhatsApp/ })).toHaveAccessibleName(/Sin costo por ahora/)

        fireEvent.click(ota)
        fireEvent.click(screen.getByRole("checkbox", { name: /WhatsApp/ }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        await waitFor(() => expect(mocks.configure).toHaveBeenCalledWith("delivery", {
            statusProviderId: 8,
            parameters: { channels: ["email", "whatsapp", "ota_inbox"] },
        }))
    })

    it("OTA guardado sin PMS se muestra marcado, avisa y se puede retirar", async () => {
        renderCard({ automation: automationWith(["email", "ota_inbox"]), pmsConnected: false })
        const ota = screen.getByRole("checkbox", { name: /Mensaje en la OTA/ })
        expect(ota).toBeChecked()
        expect(screen.getByRole("status")).toHaveTextContent(/no tiene registrada una integración con Kunas o Calry/)

        fireEvent.click(ota)
        expect(screen.queryByRole("status")).toBeNull()
        // Desmarcada sigue visible: lo guardado no desaparece antes de guardar.
        expect(screen.getByRole("checkbox", { name: /Mensaje en la OTA/ })).not.toBeChecked()
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        await waitFor(() => expect(mocks.configure).toHaveBeenCalledWith("delivery", {
            statusProviderId: 8,
            parameters: { channels: ["email"] },
        }))
    })

    it("el 422 de canales se muestra tal cual junto a las casillas, sin toast genérico", async () => {
        const message = "El canal de mensaje de OTA requiere que la propiedad esté conectada a KunasPMS o Calry."
        mocks.configure.mockRejectedValue(new ApiError(422, {
            message: "Datos inválidos",
            errors: { "parameters.channels": [message] },
        }))
        renderCard({ automation: automationWith(["email"]), pmsConnected: true })

        fireEvent.click(screen.getByRole("checkbox", { name: /Mensaje en la OTA/ }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        expect(await screen.findByRole("alert")).toHaveTextContent(message)
        expect(mocks.toastError).not.toHaveBeenCalled()
    })

    it("la primera vez crea la fila inactiva con el provider de WhatsApp y luego configura", async () => {
        mocks.create.mockResolvedValue({ ...automationWith([]), isActive: false, statusProviderId: 10 })
        renderCard({ automation: null, pmsConnected: true })

        fireEvent.click(screen.getByRole("checkbox", { name: /Mensaje en la OTA/ }))
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

        await waitFor(() => expect(mocks.configure).toHaveBeenCalled())
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
            providerId: 42,
            parameters: {},
            statusProviderId: 10,
        }))
        expect(mocks.configure.mock.calls[0][1]).toEqual({
            statusProviderId: 8,
            parameters: { channels: ["email", "ota_inbox"] },
        })
    })
})
