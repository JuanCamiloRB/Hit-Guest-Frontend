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
}))

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
        create: vi.fn(), update: vi.fn(), remove: vi.fn(),
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
            create: vi.fn(),
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
