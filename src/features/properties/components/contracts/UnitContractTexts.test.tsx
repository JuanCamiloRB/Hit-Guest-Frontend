import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError } from "@/types/api"
import type { ListingAutomationOverride } from "../../types/automation"
import type { ContractRoutingView } from "../../types/contract-routing"

const mocks = vi.hoisted(() => ({
    calls: [] as string[],
    propertyDocs: [] as unknown[],
    unitDocs: [] as unknown[],
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    createListingOverride: vi.fn(),
    listListingOverrides: vi.fn(),
}))

vi.mock("../../services/property-document-service", () => ({
    propertyDocumentService: {
        list: async (_property: string, params: { listingUuid?: string }) => ({
            items: params.listingUuid ? mocks.unitDocs : mocks.propertyDocs,
            meta: { total: 0 },
        }),
        getTypes: async () => [],
        create: (...args: unknown[]) => { mocks.calls.push("create-document"); return mocks.create(...args) },
        update: mocks.update,
        remove: mocks.remove,
    },
}))
vi.mock("../../services/reservation-source-service", () => ({
    reservationSourceService: {
        list: async () => [
            { id: 21, catalogCategoryId: 6, name: "Directo", slug: "direct", order: 1, status: "ACT" },
            { id: 23, catalogCategoryId: 6, name: "Booking.com", slug: "booking", order: 3, status: "ACT" },
        ],
    },
}))
vi.mock("../../services/automation-service", () => ({
    automationService: {
        createListingOverride: (...args: unknown[]) => { mocks.calls.push("create-override"); return mocks.createListingOverride(...args) },
        listListingOverrides: mocks.listListingOverrides,
    },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { UnitContractTexts } from "./UnitContractTexts"

function doc(uuid: string, reservationSourceId: number | null, listingUuid: string | null = null) {
    return { uuid, propertyUuid: "p-1", reservationSourceId, listingUuid, content: `<p>${uuid}</p>` }
}

function override(contractRouting: Partial<ContractRoutingView> = {}): ListingAutomationOverride {
    return {
        uuid: "ov-1", listingUuid: "unit-1", propertyAutomationUuid: "contract-row", parameters: null, token: null,
        statusRecordId: 6, deletedAt: null, isActive: true,
        contractRouting: {
            modeLabel: "", channels: [], needsAttention: false, disabled: false, routingSource: "property",
            replacedTexts: [], replacedTextsLabel: null, ...contractRouting,
        },
    }
}

function renderSection(current: ListingAutomationOverride | null) {
    const onOverrideChanged = vi.fn()
    render(
        <UnitContractTexts
            propertyUuid="p-1"
            listingUuid="unit-1"
            propertyAutomationUuid="contract-row"
            override={current}
            propertyRouting={null}
            onOverrideChanged={onOverrideChanged}
        />,
    )
    return { onOverrideChanged }
}

describe("UnitContractTexts — texto del contrato por unidad (contrato 2026-10-20)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.calls = []
        mocks.propertyDocs = [doc("p21", 21), doc("p23", 23)]
        mocks.unitDocs = []
        mocks.create.mockResolvedValue(doc("u23", 23, "unit-1"))
        mocks.createListingOverride.mockResolvedValue(override())
        mocks.listListingOverrides.mockResolvedValue([override()])
    })

    it("sin override, lo crea ACTIVO antes del texto: un texto sin override no aplicaría", async () => {
        const { onOverrideChanged } = renderSection(null)
        const user = userEvent.setup()

        const booking = (await screen.findByText("Booking.com")).closest("li")!
        await user.click(within(booking).getByRole("button", { name: "Usar un texto propio" }))
        await user.click(within(booking).getByRole("button", { name: "Guardar texto" }))

        await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled())
        expect(mocks.calls).toEqual(["create-override", "create-document"])
        expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "contract-row", statusRecordId: 6, parameters: null,
        })
        expect(mocks.create).toHaveBeenCalledWith("p-1", {
            propertyDocumentTypeId: 92, statusRecordId: 6, listingUuid: "unit-1", reservationSourceId: 23, content: "<p>p23</p>",
        })
        expect(onOverrideChanged).toHaveBeenCalled()
    })

    it("con texto general en la propiedad, la unidad no manda canal", async () => {
        mocks.propertyDocs = [doc("general", null)]
        renderSection(override())
        const user = userEvent.setup()

        const row = (await screen.findByText("Todos los canales")).closest("li")!
        await user.click(within(row).getByRole("button", { name: "Usar un texto propio" }))
        await user.click(within(row).getByRole("button", { name: "Guardar texto" }))

        await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled())
        expect(mocks.create.mock.calls[0][1]).not.toHaveProperty("reservationSourceId")
        expect(mocks.createListingOverride).not.toHaveBeenCalled()
    })

    it("un 422 se muestra tal cual en la fila", async () => {
        mocks.create.mockRejectedValue(new ApiError(422, {
            message: "x",
            errors: { reservationSourceId: ["La unidad ya tiene texto para Booking.com."] },
        }))
        renderSection(override())
        const user = userEvent.setup()

        const booking = (await screen.findByText("Booking.com")).closest("li")!
        await user.click(within(booking).getByRole("button", { name: "Usar un texto propio" }))
        await user.click(within(booking).getByRole("button", { name: "Guardar texto" }))

        expect(await within(booking).findByRole("alert")).toHaveTextContent("La unidad ya tiene texto para Booking.com.")
    })

    it("textos reemplazados: avisa con el texto del backend, bloquea crear nuevos y deja borrarlos", async () => {
        mocks.unitDocs = [doc("viejo", null, "unit-1")]
        renderSection(override({
            replacedTexts: [{ uuid: "viejo", channel: { id: null, slug: "all", name: "Todos los canales" } }],
            replacedTextsLabel: "Su texto ya no aplica: Ana Pérez cambió el modo del contrato de la propiedad el 20/10/2026 14:05.",
            needsAttention: true,
        }))
        const user = userEvent.setup()

        expect(await screen.findByText(/Ana Pérez cambió el modo/)).toBeInTheDocument()
        const booking = screen.getByText("Booking.com").closest("li")!
        expect(within(booking).getByRole("button", { name: "Usar un texto propio" })).toBeDisabled()

        await user.click(screen.getByRole("button", { name: "Borrar" }))
        await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("p-1", "viejo"))
    })

    it("si la propiedad no tiene texto, no ofrece nada que reemplazar", async () => {
        mocks.propertyDocs = []
        renderSection(override())
        expect(await screen.findByText(/La propiedad todavía no tiene texto de contrato/)).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Usar un texto propio" })).toBeNull()
    })
})
