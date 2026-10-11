import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"

// Radix Select usa APIs de puntero que jsdom no implementa.
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}

import { PropertiesAutomation } from "./PropertiesAutomation"
import { AUTOMATION_STATUS, type PropertyAutomation, type Provider } from "../types/automation"

const listAutomations = vi.fn()
const listProviders = vi.fn()

vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return {
        ...actual,
        automationService: {
            list: (...args: unknown[]) => listAutomations(...args),
            listProviders: (...args: unknown[]) => listProviders(...args),
            findProviderBySlug: async () => null,
        },
    }
})
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getCountries: async () => [{ id: 48, iso2: "CO" }] },
}))
vi.mock("../services/listings-service", () => ({
    listingsService: { listByProperty: async () => [] },
}))
vi.mock("../services/reservation-source-service", () => ({
    reservationSourceService: { list: async () => [] },
}))
// La tarjeta del link tiene sus propios tests y sus propias llamadas.
vi.mock("./automations", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./automations")>()
    return { ...actual, CheckinLinkDeliveryCard: () => null }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function makeProvider(id: number, slug: string, countries?: string[]): Provider {
    return {
        id,
        name: slug,
        description: null,
        parameters: {
            slug,
            internalUse: { path: slug },
            billing: { billable: false, unit_cost: 0 },
            // didit y textract llegan SIN `applicable_countries` (skill §1).
            ...(countries ? { applicable_countries: countries } : {}),
        },
        order: 0,
        statusProviderId: 8,
    }
}

const DIDIT = makeProvider(1000, "didit")
const TEXTRACT = makeProvider(1004, "textract")
/** Lo que devuelve `?country=CO`: sin didit ni textract. */
const CO_ROWS = [makeProvider(1005, "hitguest_signature", ["ALL"])]

/** Verificación principal ACTIVA con Avanzada (didit), el caso de Didier. */
const DIDIT_MAIN: PropertyAutomation = {
    uuid: "identity-main",
    propertyUuid: "property-1",
    providerId: 1000,
    providerName: "didit",
    provider: DIDIT,
    name: "Identity Verification - Main Guest",
    guestType: "main_guest",
    executionOrder: 1,
    parameters: {},
    token: null,
    statusProviderId: AUTOMATION_STATUS.ACTIVE,
    deletedAt: null,
    isActive: true,
}

function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm({ defaultValues: { uuid: "property-1", countryId: 48, externalPmsIds: [] } })
    return <FormProvider {...form}>{children}</FormProvider>
}

const renderTab = () => render(<PropertiesAutomation />, { wrapper: Wrapper })
const isCountryQuery = (params: { country?: string }) => params?.country === "CO"

async function openIdentitySelector() {
    const user = userEvent.setup()
    await user.click(await screen.findByRole("combobox"))
    return user
}

describe("PropertiesAutomation — Avanzada guardada no bloquea la Esencial (Didier, 2026-10-12)", () => {
    beforeEach(() => {
        listAutomations.mockReset().mockResolvedValue([DIDIT_MAIN])
        listProviders.mockReset()
    })

    it("consulta el país, detecta la falta, consulta el catálogo global y muestra el selector con las dos", async () => {
        listProviders.mockImplementation(async (params: { country?: string }) =>
            isCountryQuery(params) ? CO_ROWS : [...CO_ROWS, DIDIT, TEXTRACT])

        renderTab()
        await openIdentitySelector()

        expect(await screen.findByRole("option", { name: /verificación esencial/i })).toBeInTheDocument()
        expect(screen.getByRole("option", { name: /verificación avanzada/i })).toBeInTheDocument()
        expect(listProviders).toHaveBeenCalledTimes(2)
        expect(listProviders).toHaveBeenNthCalledWith(1, { statusProviderId: 8, country: "CO" })
        expect(listProviders).toHaveBeenNthCalledWith(2, { statusProviderId: 8 })
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("si el país ya trae los dos, no hace la consulta global", async () => {
        listProviders.mockResolvedValue([...CO_ROWS, DIDIT, TEXTRACT])

        renderTab()
        await openIdentitySelector()

        expect(await screen.findByRole("option", { name: /verificación esencial/i })).toBeInTheDocument()
        expect(listProviders).toHaveBeenCalledTimes(1)
    })

    it("si falla la consulta global, avisa sin tumbar la pestaña y Reintentar la recupera", async () => {
        let globalCalls = 0
        listProviders.mockImplementation(async (params: { country?: string }) => {
            if (isCountryQuery(params)) return CO_ROWS
            globalCalls += 1
            if (globalCalls === 1) throw new Error("HTTP 500")
            return [...CO_ROWS, DIDIT, TEXTRACT]
        })
        vi.spyOn(console, "error").mockImplementation(() => {})

        renderTab()

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("No pudimos cargar todos los proveedores de identidad")
        // La pestaña sigue: la tarjeta de identidad está, con el proveedor guardado.
        expect(screen.getByText("Verificación de Identidad (Principal)")).toBeInTheDocument()

        await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }))

        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
        await openIdentitySelector()
        expect(await screen.findByRole("option", { name: /verificación esencial/i })).toBeInTheDocument()
    })
})
