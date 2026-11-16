import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { ReactNode } from "react"
import type { ListingAutomationOverride, PropertyAutomation } from "../types/automation"

window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.scrollIntoView = () => {}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

const mocks = vi.hoisted(() => ({ listGlobal: vi.fn(), listListingOverrides: vi.fn() }))

vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getRoomTypes: async () => [], getCurrencies: async () => [], getAmenities: async () => [], getPmsSources: async () => [] },
}))
vi.mock("../services/listings-service", () => ({ listingsService: {} }))
vi.mock("../services/automation-service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/automation-service")>()
    return { ...actual, automationService: { listGlobal: mocks.listGlobal, listListingOverrides: mocks.listListingOverrides, listProviders: async () => [] } }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
// El modal tiene sus propias pruebas: acá solo un guardado cuya respuesta NO trae
// `credentialsStatus` (la nota solo lo garantiza en los GET).
vi.mock("./automations/AutomationOverrideModal", () => ({
    AutomationOverrideModal: ({ onSaved, override }: { onSaved: (o: ListingAutomationOverride) => void; override: ListingAutomationOverride | null }) => (
        <button
            type="button"
            onClick={() => {
                const saved = { ...override! }
                delete saved.credentialsStatus
                onSaved(saved)
            }}
        >
            simular guardar
        </button>
    ),
}))

import { PropertiesUnits } from "./PropertiesUnits"

const TRA: PropertyAutomation = {
    uuid: "tra-row", propertyUuid: "p-1", providerId: 1, name: "TRA Colombia", guestType: "all", executionOrder: 40,
    parameters: { credentials_scope: "listing" }, token: null, statusProviderId: 8, deletedAt: null, isActive: true,
    provider: null, providerName: "tra_colombia",
}
const rejected = (listingUuid: string): ListingAutomationOverride => ({
    uuid: `ov-${listingUuid}`, listingUuid, propertyAutomationUuid: "tra-row", parameters: { rnt: "1" }, token: null,
    statusRecordId: 6, deletedAt: null, isActive: true, credentialsComplete: true,
    credentialsStatus: { status: "rejected", reason: "token_rejected", providerMessage: null, since: null },
})

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
}

function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm({ defaultValues: { uuid: "p-1", statusRecordId: 6, units: [
        { uuid: "l-1", name: "Suite 101", internalName: "101", isActive: true },
        { uuid: "l-2", name: "Suite 102", internalName: "102", isActive: true },
    ] } })
    return <FormProvider {...form}>{children}</FormProvider>
}

async function openAutomationsOf(user: ReturnType<typeof userEvent.setup>, name: string) {
    const row = screen.getByText(name).closest("tr")!
    await user.click(within(row).getAllByRole("button")[0])
    await user.click(await screen.findByRole("tab", { name: /Automatizaciones/ }))
}

describe("PropertiesUnits — override en pausa por credenciales (nota backend 2026-11-11)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
        mocks.listGlobal.mockResolvedValue([TRA])
        mocks.listListingOverrides.mockImplementation(async (uuid: string) => uuid === "l-1" ? [rejected("l-1")] : [])
    })

    it("muestra el aviso en la pestaña AUTOM. y, si el guardado no dice si levantó la pausa, relee", async () => {
        const user = userEvent.setup()
        render(<Wrapper><PropertiesUnits /></Wrapper>)
        await openAutomationsOf(user, "Suite 101")
        expect(await screen.findByText("Credenciales rechazadas")).toBeInTheDocument()

        await user.click(screen.getByRole("button", { name: /Actualizar credenciales/ }))
        mocks.listListingOverrides.mockClear()
        mocks.listListingOverrides.mockResolvedValue([{ ...rejected("l-1"), credentialsStatus: null }])
        fireEvent.click(screen.getByRole("button", { name: "simular guardar", hidden: true }))
        await waitFor(() => expect(mocks.listListingOverrides).toHaveBeenCalledWith("l-1"))
    })

    it("una relectura que llega con OTRA unidad abierta no escribe en ella", async () => {
        const user = userEvent.setup()
        render(<Wrapper><PropertiesUnits /></Wrapper>)
        await openAutomationsOf(user, "Suite 101")
        await user.click(await screen.findByRole("button", { name: /Actualizar credenciales/ }))

        const reread = deferred<ListingAutomationOverride[]>()
        mocks.listListingOverrides.mockImplementation((uuid: string) => uuid === "l-1" ? reread.promise : Promise.resolve([]))
        fireEvent.click(screen.getByRole("button", { name: "simular guardar", hidden: true }))

        // Se cierra la unidad A y se abre B antes de que vuelva la relectura de A.
        await user.keyboard("{Escape}")
        await waitFor(() => expect(screen.queryByRole("tab", { name: /Automatizaciones/ })).toBeNull())
        await openAutomationsOf(user, "Suite 102")
        await waitFor(() => expect(mocks.listListingOverrides).toHaveBeenCalledWith("l-2"))

        reread.resolve([rejected("l-1")])
        await new Promise((done) => setTimeout(done, 0))
        expect(screen.queryByText("Credenciales rechazadas")).toBeNull()
    })
})
