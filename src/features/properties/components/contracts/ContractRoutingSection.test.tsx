import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"
import type { PropertyAutomation, Provider } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    automations: [] as unknown[],
    documents: [] as unknown[],
    configure: vi.fn(),
    docUpdate: vi.fn(),
    docCreate: vi.fn(),
    docRemove: vi.fn(),
    automationCreate: vi.fn(),
}))

// Radix Select usa APIs de puntero que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getCountries: async () => [{ id: 48, extra: { iso2: "CO" } }] },
}))
vi.mock("../../services/reservation-source-service", () => ({
    reservationSourceService: {
        list: async () => [
            { id: 21, catalogCategoryId: 6, name: "Directo", order: 1, status: "ACT" },
            { id: 22, catalogCategoryId: 6, name: "Airbnb", order: 2, status: "ACT" },
        ],
    },
}))
vi.mock("../../services/property-document-service", () => ({
    propertyDocumentService: {
        list: async () => ({ items: mocks.documents, meta: { total: mocks.documents.length } }),
        getTypes: async () => [],
        create: mocks.docCreate, update: mocks.docUpdate, remove: mocks.docRemove,
    },
}))
vi.mock("../../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../services/automation-service")>()
    return {
        ...actual,
        automationService: {
            listProviders: async () => [SIGNATURE],
            list: async () => mocks.automations,
            configure: mocks.configure,
            create: mocks.automationCreate,
        },
    }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const SIGNATURE: Provider = {
    id: 1005, name: "HitGuest Signature", description: null, order: 0, statusProviderId: 8,
    parameters: { slug: "hitguest_signature", signature: { synchronous: true, contract_types: ["agreement_only"] } },
}

function signatureRow(bySource: unknown): PropertyAutomation {
    return {
        uuid: "contract-row", propertyUuid: "p-1", providerId: 1005, providerName: "hitguest_signature", provider: SIGNATURE,
        name: "Digital Signature", guestType: "main_guest", executionOrder: 10, token: null, deletedAt: null,
        statusProviderId: 8, isActive: true,
        parameters: { contract_mode: "per_source", by_source: bySource },
    }
}

const ROUTE = { contract_type: "agreement_only", provider_slug: "hitguest_signature" }

function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm({ defaultValues: { countryId: 48 } })
    return <FormProvider {...form}>{children}</FormProvider>
}

import { ApiError } from "@/types/api"
import { ContractRoutingSection } from "./ContractRoutingSection"

describe("ContractRoutingSection — configuración guardada con claves que no son canales (reporte 2026-10-18)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.documents = []
    })

    // Backend anterior al 2026-10-19: convertía `by_source` en lista al responder.
    it("con `by_source` como lista avisa en lenguaje claro y bloquea editar y guardar", async () => {
        mocks.automations = [signatureRow([ROUTE, ROUTE, ROUTE])]
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("No pudimos identificar los canales de la configuración guardada.")
        expect(alert).toHaveTextContent("la edición está bloqueada temporalmente")
        // El «Canal 0» ya no está a la vista: va plegado como información técnica.
        expect(alert).not.toHaveTextContent(/^Canal 0/)
        expect(within(alert).getByText("Información técnica")).toBeInTheDocument()
        expect(alert).toHaveTextContent("Clave guardada «0»")

        const save = screen.getByRole("button", { name: "Guardar contrato y firma" })
        expect(save).toBeDisabled()
        expect(document.querySelector("[inert]")).not.toBeNull()
        await userEvent.setup().click(save)
        expect(mocks.configure).not.toHaveBeenCalled()
    })

    it("con claves de canales reales no bloquea nada y muestra el canal por su nombre", async () => {
        mocks.automations = [signatureRow({ 21: ROUTE })]
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })

        expect(await screen.findByText("Directo")).toBeInTheDocument()
        expect(screen.queryByText(/No pudimos identificar los canales/)).toBeNull()
        expect(screen.getByText("La configuración está guardada.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Guardar contrato y firma" })).toBeDisabled()
        expect(document.querySelector("[inert]")).toBeNull()
    })

    it("muestra también los canales sin contrato y marca el primer cambio sin guardar", async () => {
        mocks.automations = [signatureRow({ 21: ROUTE })]
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })

        expect(await screen.findByText("Airbnb")).toBeInTheDocument()
        expect(screen.getByText("Las reservas de este canal no firman contrato.")).toBeInTheDocument()

        await userEvent.setup().click(screen.getByRole("button", { name: /Configurar/ }))

        expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument()
        expect(screen.getByText("Tienes cambios sin guardar.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Guardar contrato y firma" })).toBeEnabled()
    })
})

describe("ContractRoutingSection — contrato 2026-10-19", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.documents = [{ uuid: "doc-21", propertyDocumentTypeId: 92, reservationSourceId: 21, content: "<p>Texto</p>" }]
    })

    it("una clave que no es canal no bloquea la edición, pero no se borra hasta que el PM lo pide", async () => {
        mocks.automations = [signatureRow({ 21: ROUTE, 999: ROUTE })]
        mocks.configure.mockResolvedValue(signatureRow({ 21: ROUTE }))
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        expect(await screen.findByText("Hay configuración guardada para un canal que ya no existe.")).toBeInTheDocument()
        expect(screen.queryByText(/No pudimos identificar los canales/)).toBeNull()
        expect(document.querySelector("[inert]")).toBeNull()

        // `by_source` se reemplaza completo: guardar sin decidir la borraría de rebote.
        const save = screen.getByRole("button", { name: "Guardar contrato y firma" })
        expect(save).toBeDisabled()
        expect(screen.getByText("Quita la configuración desconocida para poder guardar.")).toBeInTheDocument()

        await user.click(screen.getByRole("button", { name: "Quitar configuración desconocida" }))
        expect(screen.getByText(/Se quitará cuando guardes/)).toBeInTheDocument()
        expect(save).toBeEnabled()
        await user.click(save)

        expect(mocks.configure).toHaveBeenCalledTimes(1)
        const sent = mocks.configure.mock.calls[0][1].parameters
        expect(Object.keys(sent.by_source)).toEqual(["21"])
    })

    it("un 422 muestra todos los mensajes del backend, tal cual", async () => {
        mocks.automations = [signatureRow({ 21: ROUTE, 999: ROUTE })]
        mocks.configure.mockRejectedValue(new ApiError(422, {
            // El `message` repite el primer error: no por eso deja de mostrarse.
            message: "Airbnb ya tiene un contrato activo. Edita ese contrato en vez de crear o restaurar otro.",
            errors: {
                "parameters.by_source.22": ["Airbnb ya tiene un contrato activo. Edita ese contrato en vez de crear o restaurar otro."],
                "parameters.by_source.23": ["Falta el texto del contrato para: Booking.com. Créalo en Documentos y vuelve a guardar."],
            },
        }))
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        await user.click(await screen.findByRole("button", { name: "Quitar configuración desconocida" }))
        await user.click(screen.getByRole("button", { name: "Guardar contrato y firma" }))

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("Airbnb ya tiene un contrato activo. Edita ese contrato en vez de crear o restaurar otro.")
        expect(alert).toHaveTextContent("Falta el texto del contrato para: Booking.com. Créalo en Documentos y vuelve a guardar.")
    })
})

/** El 422 del contrato 2026-10-20 §2.5. */
function unitOverridesError() {
    return new ApiError(422, {
        message: "Este cambio reemplaza la configuración del contrato de algunas unidades. (and 1 more error)",
        errors: {
            confirmUnitOverrides: [
                "Este cambio reemplaza la configuración del contrato de algunas unidades. Revisa cuáles y confirma para aplicarlo.",
                "Apartamento 101: su texto propio para todos los canales dejará de aplicar.",
            ],
        },
        meta: { affectedUnits: [{ listingUuid: "unit-101", listingName: "Apartamento 101", replacedTexts: [], channelsLeftWithoutText: [] }] },
    })
}

describe("ContractRoutingSection — textos de las unidades (contrato 2026-10-20)", () => {
    const channelDoc = { uuid: "doc-21", propertyDocumentTypeId: 92, reservationSourceId: 21, content: "<p>Texto</p>" }
    // Un texto de UNIDAD que se colara en la lista: nunca se convierte ni se borra.
    const unitDoc = { uuid: "unit-doc", propertyDocumentTypeId: 92, reservationSourceId: 22, listingUuid: "unit-101", content: "<p>Unidad</p>" }

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.documents = [channelDoc, unitDoc]
        mocks.automations = [signatureRow({ 21: ROUTE })]
        mocks.configure.mockResolvedValue(signatureRow({ 21: ROUTE }))
    })

    async function switchToSharedTextAndSave(user: ReturnType<typeof userEvent.setup>) {
        await user.click(await screen.findByRole("radio", { name: /Mismo texto para todos los canales/ }))
        await user.click(screen.getByRole("button", { name: "Guardar contrato y firma" }))
    }

    it("si el backend pide confirmar, muestra las unidades y al continuar reenvía LA MISMA petición confirmada", async () => {
        mocks.docUpdate.mockRejectedValueOnce(unitOverridesError()).mockResolvedValueOnce({})
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        await switchToSharedTextAndSave(user)

        const dialog = await screen.findByRole("alertdialog")
        expect(dialog).toHaveTextContent("Apartamento 101: su texto propio para todos los canales dejará de aplicar.")
        await user.click(within(dialog).getByRole("button", { name: "Continuar" }))

        await vi.waitFor(() => expect(mocks.configure).toHaveBeenCalled())
        expect(mocks.docUpdate.mock.calls).toEqual([
            ["p-1", "doc-21", { reservationSourceId: null, content: "<p>Texto</p>" }, { confirmUnitOverrides: false }],
            ["p-1", "doc-21", { reservationSourceId: null, content: "<p>Texto</p>" }, { confirmUnitOverrides: true }],
        ])
        // El texto de la unidad no entra en el plan de la propiedad.
        expect(mocks.docRemove).not.toHaveBeenCalled()
    })

    it("si cancela antes de escribir nada, no se guarda nada y conserva lo que editaba", async () => {
        mocks.docUpdate.mockRejectedValueOnce(unitOverridesError())
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        await switchToSharedTextAndSave(user)
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }))

        expect(await screen.findByText(/No se guardó nada/)).toBeInTheDocument()
        expect(mocks.docUpdate).toHaveBeenCalledTimes(1)
        expect(mocks.configure).not.toHaveBeenCalled()
        expect(screen.getByRole("radio", { name: /Mismo texto para todos los canales/ })).toHaveAttribute("aria-checked", "true")
    })
})

describe("ContractRoutingSection — un solo texto con firma por canal (contrato 2026-10-19 §2.4 bis)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.documents = [{ uuid: "general", propertyDocumentTypeId: 92, reservationSourceId: null, content: "<p>General</p>" }]
    })

    it("una propiedad por canal con texto general se muestra así, sin canales «incompletos»", async () => {
        mocks.automations = [signatureRow({ 21: ROUTE })]
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })

        expect(await screen.findByRole("radio", { name: /Mismo texto para todos los canales/ })).toHaveAttribute("aria-checked", "true")
        expect(screen.queryByText("Incompleto")).toBeNull()
        expect(screen.getByText("La configuración está guardada.")).toBeInTheDocument()
    })

    it("pasar a firma por canal no parte el texto general", async () => {
        mocks.automations = [{ ...signatureRow({}), parameters: { contract_mode: "all_sources", by_source: { all: ROUTE } } }]
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        await user.click(await screen.findByRole("radio", { name: /Un contrato para cada canal/ }))

        expect(screen.getByRole("radio", { name: /Mismo texto para todos los canales/ })).toHaveAttribute("aria-checked", "true")
    })
})

describe("ContractRoutingSection — cancelar después de crear la fila de Contrato (auditoría 2026-10-23)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.automations = []
        mocks.documents = [{ uuid: "doc-21", propertyDocumentTypeId: 92, reservationSourceId: 21, content: "<p>Texto</p>" }]
        mocks.automationCreate.mockResolvedValue(signatureRow({}))
    })

    it("si la fila ya se creó, no dice «no se guardó nada»: reconcilia y avisa", async () => {
        mocks.docUpdate.mockRejectedValueOnce(unitOverridesError())
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        const directo = (await screen.findByText("Directo")).closest("article")!
        await user.click(within(directo).getByRole("button", { name: /Configurar/ }))
        await user.click(within(directo).getByRole("combobox"))
        await user.click(await screen.findByRole("option", { name: "HitGuest Signature" }))
        await user.click(screen.getByRole("radio", { name: /Mismo texto para todos los canales/ }))
        await user.click(screen.getByRole("button", { name: "Guardar contrato y firma" }))
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }))

        expect(mocks.automationCreate).toHaveBeenCalledTimes(1)
        expect(await screen.findByText(/Los pasos anteriores sí quedaron guardados/)).toBeInTheDocument()
        expect(screen.queryByText(/No se guardó nada/)).toBeNull()
        expect(mocks.configure).not.toHaveBeenCalled()
    })
})

describe("ContractRoutingSection — de un contrato para todos a uno por canal, sin confirmaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.documents = [{ uuid: "general", propertyDocumentTypeId: 92, reservationSourceId: null, content: "<p>General</p>" }]
        mocks.automations = [{ ...signatureRow({}), parameters: { contract_mode: "all_sources", by_source: { all: ROUTE } } }]
        mocks.configure.mockResolvedValue(signatureRow({ 21: ROUTE }))
    })

    it("conserva el texto general: no toca documentos y solo configura la firma", async () => {
        render(<ContractRoutingSection propertyUuid="p-1" />, { wrapper: Wrapper })
        const user = userEvent.setup()

        await user.click(await screen.findByRole("radio", { name: /Un contrato para cada canal/ }))
        // Tras cambiar de modo el canal sale «con cambios», y su botón dice «Editar».
        const directo = screen.getByText("Directo").closest("article")!
        await user.click(within(directo).getByRole("button", { name: /Configurar|Editar/ }))
        await user.click(within(directo).getByRole("combobox"))
        await user.click(await screen.findByRole("option", { name: "HitGuest Signature" }))
        await user.click(screen.getByRole("button", { name: "Guardar contrato y firma" }))

        await vi.waitFor(() => expect(mocks.configure).toHaveBeenCalled())
        expect(mocks.docUpdate).not.toHaveBeenCalled()
        expect(mocks.docCreate).not.toHaveBeenCalled()
        expect(mocks.docRemove).not.toHaveBeenCalled()
        expect(screen.queryByRole("alertdialog")).toBeNull()
        expect(mocks.configure.mock.calls[0][1].parameters).toEqual({ contract_mode: "per_source", by_source: { 21: ROUTE } })
    })
})
