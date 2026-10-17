import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"
import type { PropertyAutomation, Provider } from "../../types/automation"

const mocks = vi.hoisted(() => ({
    automations: [] as unknown[],
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
        list: async () => ({ items: [], meta: { total: 0 } }),
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

function signatureRow(bySource: Record<string, unknown>): PropertyAutomation {
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

import { ContractRoutingSection } from "./ContractRoutingSection"

describe("ContractRoutingSection — configuración guardada con claves que no son canales (reporte 2026-10-18)", () => {
    beforeEach(() => vi.clearAllMocks())

    it("con claves 0/1/2 avisa en lenguaje claro y bloquea editar y guardar", async () => {
        mocks.automations = [signatureRow({ 0: ROUTE, 1: ROUTE, 2: ROUTE })]
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
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar contrato y firma" })).toBeEnabled())
        expect(document.querySelector("[inert]")).toBeNull()
    })
})
