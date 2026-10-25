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
        update: (...args: unknown[]) => { mocks.calls.push("update-document"); return mocks.update(...args) },
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

describe("UnitContractTexts — texto efectivo y vista desactualizada (auditoría 2026-10-23)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.calls = []
        mocks.propertyDocs = [doc("p21", 21), doc("p23", 23)]
        mocks.unitDocs = [doc("u23", 23, "unit-1")]
        mocks.create.mockResolvedValue(doc("u21", 21, "unit-1"))
        mocks.listListingOverrides.mockResolvedValue([override()])
    })

    const channel = (id: number, name: string, documentUuid: string) => ({
        key: String(id), channel: { id, slug: null, name }, contractType: "agreement_only" as const,
        contractTypeLabel: "Contrato de alquiler", provider: null, document: { uuid: documentUuid, updatedAt: null },
        status: "ready", statusLabel: "Listo", summary: `${name} · Contrato de alquiler · Firma nativa (en el portal)`,
    })

    it("dice qué texto firma cada canal según el backend, con su resumen, y deja verlo sin editar", async () => {
        renderSection(override({ channels: [channel(21, "Directo", "p21"), channel(23, "Booking.com", "u23")] }))

        const directo = (await screen.findByText("Directo")).closest("li")!
        expect(within(directo).getByText("Firma el texto de la propiedad")).toBeInTheDocument()
        expect(within(directo).getByText("Directo · Contrato de alquiler · Firma nativa (en el portal)")).toBeInTheDocument()
        expect(within(directo).getByRole("button", { name: "Ver texto" })).toBeInTheDocument()

        const booking = screen.getByText("Booking.com").closest("li")!
        expect(within(booking).getByText("Firma el texto propio de esta unidad")).toBeInTheDocument()
    })

    it("si la relectura falla tras guardar, lo avisa y deja volver a cargar", async () => {
        mocks.listListingOverrides.mockRejectedValueOnce(new Error("red"))
        renderSection(override())
        const user = userEvent.setup()

        const directo = (await screen.findByText("Directo")).closest("li")!
        await user.click(within(directo).getByRole("button", { name: "Usar un texto propio" }))
        await user.click(within(directo).getByRole("button", { name: "Guardar texto" }))

        expect(await screen.findByText(/no pudimos actualizar esta vista/)).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: /Volver a cargar/ }))
        await vi.waitFor(() => expect(screen.queryByText(/no pudimos actualizar esta vista/)).toBeNull())
    })
})

describe("UnitContractTexts — qué se dice después de una escritura (auditoría 2026-10-23)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.calls = []
        mocks.propertyDocs = [doc("p21", 21)]
        mocks.unitDocs = []
        mocks.createListingOverride.mockResolvedValue(override())
        mocks.listListingOverrides.mockResolvedValue([override()])
    })

    async function saveDirecto() {
        const user = userEvent.setup()
        const directo = (await screen.findByText("Directo")).closest("li")!
        await user.click(within(directo).getByRole("button", { name: "Usar un texto propio" }))
        await user.click(within(directo).getByRole("button", { name: "Guardar texto" }))
        return directo
    }

    it("rechazada sin escribir nada: muestra el error, no relee y no dice que se guardó", async () => {
        mocks.create.mockRejectedValue(new ApiError(422, { message: "x", errors: { listingUuid: ["La unidad no es de esta propiedad."] } }))
        renderSection(override())

        const directo = await saveDirecto()

        expect(await within(directo).findByRole("alert")).toHaveTextContent("La unidad no es de esta propiedad.")
        expect(mocks.listListingOverrides).not.toHaveBeenCalled()
        expect(screen.queryByText(/se guardó/)).toBeNull()
    })

    it("override creado pero texto rechazado, y la relectura falla: lo dice tal cual", async () => {
        mocks.create.mockRejectedValue(new ApiError(422, { message: "x", errors: { reservationSourceId: ["Elige el canal."] } }))
        mocks.listListingOverrides.mockRejectedValue(new Error("red"))
        renderSection(null)

        const directo = await saveDirecto()

        expect(await within(directo).findByRole("alert")).toHaveTextContent("Se activó el contrato en esta unidad, pero el texto no se guardó.")
        expect(await screen.findByText("Se activó el contrato en esta unidad, pero el texto no se guardó y no pudimos actualizar esta vista.")).toBeInTheDocument()
        expect(screen.queryByText(/El cambio se guardó/)).toBeNull()
    })

    it("un fallo de red no permite saber si se guardó: relee y, si eso también falla, lo admite", async () => {
        mocks.create.mockRejectedValue(new TypeError("Failed to fetch"))
        mocks.listListingOverrides.mockRejectedValue(new Error("red"))
        renderSection(override())

        await saveDirecto()

        expect(await screen.findByText(/No pudimos confirmar si el cambio se guardó/)).toBeInTheDocument()
    })

    it("una relectura que no trae el override esperado cuenta como incompleta", async () => {
        mocks.create.mockResolvedValue(doc("u21", 21, "unit-1"))
        mocks.listListingOverrides.mockResolvedValue([])
        renderSection(override())

        await saveDirecto()

        expect(await screen.findByText(/El cambio se guardó, pero no pudimos actualizar esta vista/)).toBeInTheDocument()
    })
})

describe("UnitContractTexts — texto conservado tras «Volver a heredar» (auditoría 2026-10-23)", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.calls = []
        mocks.propertyDocs = [doc("p23", 23)]
        // El override se borró, pero el texto propio de la unidad quedó guardado.
        mocks.unitDocs = [doc("u23", 23, "unit-1")]
        mocks.update.mockResolvedValue(doc("u23", 23, "unit-1"))
        mocks.createListingOverride.mockResolvedValue(override())
        mocks.listListingOverrides.mockResolvedValue([override()])
    })

    it("editarlo sin override crea primero el override activo, y después actualiza el texto", async () => {
        const { onOverrideChanged } = renderSection(null)
        const user = userEvent.setup()

        const booking = (await screen.findByText("Booking.com")).closest("li")!
        await user.click(within(booking).getByRole("button", { name: "Editar texto propio" }))
        await user.click(within(booking).getByRole("button", { name: "Guardar texto" }))

        await vi.waitFor(() => expect(mocks.update).toHaveBeenCalled())
        expect(mocks.calls).toEqual(["create-override", "update-document"])
        expect(mocks.createListingOverride).toHaveBeenCalledWith({
            listingUuid: "unit-1", propertyAutomationUuid: "contract-row", statusRecordId: 6, parameters: null,
        })
        expect(mocks.update).toHaveBeenCalledWith("p-1", "u23", { content: "<p>u23</p>" })
        expect(onOverrideChanged).toHaveBeenCalled()
    })

    it("con override activo, editar no crea otro", async () => {
        renderSection(override())
        const user = userEvent.setup()

        const booking = (await screen.findByText("Booking.com")).closest("li")!
        await user.click(within(booking).getByRole("button", { name: "Editar texto propio" }))
        await user.click(within(booking).getByRole("button", { name: "Guardar texto" }))

        await vi.waitFor(() => expect(mocks.update).toHaveBeenCalled())
        expect(mocks.calls).toEqual(["update-document"])
    })
})
