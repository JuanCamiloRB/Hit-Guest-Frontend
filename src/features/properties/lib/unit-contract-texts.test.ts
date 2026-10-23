import { describe, it, expect } from "vitest"
import { describeRowSigning, planUnitTexts, type UnitTextRow } from "./unit-contract-texts"
import type { PropertyDocument } from "../types/document"
import type { ContractRoutingChannelView } from "../types/contract-routing"

function doc(uuid: string, reservationSourceId: number | null, listingUuid: string | null = null): PropertyDocument {
    return {
        uuid,
        propertyUuid: "p-1",
        documentType: { id: 92, name: "Agreement", parameters: { shortcodes: [] } },
        content: `<p>${uuid}</p>`,
        statusRecord: { id: 6, name: "Active" },
        reservationSourceId,
        listingUuid,
        createdAt: "2026-10-20T00:00:00Z",
        updatedAt: "2026-10-20T00:00:00Z",
        deletedAt: null,
    }
}

const SOURCES = [
    { id: 21, catalogCategoryId: 6, name: "Directo", slug: "direct", order: 1, status: "ACT" },
    { id: 22, catalogCategoryId: 6, name: "Airbnb", slug: "airbnb", order: 2, status: "ACT" },
    { id: 23, catalogCategoryId: 6, name: "Booking.com", slug: "booking", order: 3, status: "ACT" },
]

function routing(id: number, contractType: ContractRoutingChannelView["contractType"]): ContractRoutingChannelView {
    return {
        key: String(id), channel: { id, slug: null, name: `Canal ${id}` }, contractType, contractTypeLabel: "",
        provider: null, document: null, status: "ready", statusLabel: "", summary: "",
    }
}

describe("planUnitTexts — textos de contrato por unidad (contrato 2026-10-20)", () => {
    it("sin texto en la propiedad no ofrece nada: la unidad no tiene qué reemplazar", () => {
        expect(planUnitTexts({ propertyDocuments: [], unitDocuments: [], replacedUuids: new Set(), routingChannels: [], sources: SOURCES }))
            .toEqual({ textMode: null, rows: [] })
    })

    it("con texto general en la propiedad, la unidad solo puede reemplazar ese", () => {
        const plan = planUnitTexts({
            propertyDocuments: [doc("general", null)],
            unitDocuments: [],
            replacedUuids: new Set(),
            routingChannels: [routing(21, "agreement_only")],
            sources: SOURCES,
        })
        expect(plan.textMode).toBe("shared")
        expect(plan.rows).toHaveLength(1)
        expect(plan.rows[0]).toMatchObject({ key: "all", channelId: null, unitDocument: null })
        expect(plan.rows[0].propertyDocument?.uuid).toBe("general")
    })

    it("con textos por canal: una fila por canal, en el orden del catálogo, y hereda donde no personaliza", () => {
        const plan = planUnitTexts({
            propertyDocuments: [doc("p23", 23), doc("p21", 21), doc("p22", 22)],
            unitDocuments: [doc("u23", 23, "unit-1")],
            replacedUuids: new Set(),
            routingChannels: [],
            sources: SOURCES,
        })
        expect(plan.rows.map((row) => row.key)).toEqual(["21", "22", "23"])
        expect(plan.rows.map((row) => row.unitDocument?.uuid ?? null)).toEqual([null, null, "u23"])
        expect(plan.rows[2]).toMatchObject({ name: "Booking.com", slug: "booking" })
    })

    it("suma los canales que la firma necesita con contrato de alquiler, no los de solo garantía", () => {
        const plan = planUnitTexts({
            propertyDocuments: [doc("p21", 21)],
            unitDocuments: [],
            replacedUuids: new Set(),
            routingChannels: [routing(22, "agreement_and_guarantee"), routing(23, "guarantee_only")],
            sources: SOURCES,
        })
        expect(plan.rows.map((row) => row.key)).toEqual(["21", "22"])
        expect(plan.rows[1].propertyDocument).toBeNull()
    })

    it("un texto reemplazado no es una fila: no aplica y se muestra aparte", () => {
        const plan = planUnitTexts({
            propertyDocuments: [doc("p21", 21)],
            unitDocuments: [doc("viejo-general", null, "unit-1")],
            replacedUuids: new Set(["viejo-general"]),
            routingChannels: [],
            sources: SOURCES,
        })
        expect(plan.rows.map((row) => row.unitDocument)).toEqual([null])
    })
})

describe("describeRowSigning — el backend manda sobre qué se firma (auditoría 2026-10-23)", () => {
    const channel = (
        id: number,
        over: Partial<ContractRoutingChannelView> = {},
    ): ContractRoutingChannelView => ({
        ...routing(id, "agreement_only"),
        summary: `Canal ${id} · resumen`,
        ...over,
    })
    const row = (over: Partial<UnitTextRow> = {}): UnitTextRow => ({
        key: "23", channelId: 23, name: "Booking.com", slug: "booking",
        propertyDocument: doc("p23", 23), unitDocument: null, ...over,
    })
    const docs = [doc("p23", 23), doc("u23", 23, "unit-1"), doc("general", null)]

    it("solo garantía (`document: null`): no afirma que se firme un texto, aunque la propiedad tenga uno", () => {
        const signing = describeRowSigning(row(), { channels: [channel(23, { contractType: "guarantee_only", document: null })] }, docs, "unit-1")
        expect(signing.document).toBeNull()
        expect(signing.headline).toBe("En este canal no se firma texto de contrato de alquiler")
    })

    it("`missing_document`: usa el aviso del backend, no un texto deducido", () => {
        const signing = describeRowSigning(row(), {
            channels: [channel(23, { document: null, status: "missing_document", statusLabel: "Falta el texto del contrato de este canal." })],
        }, docs, "unit-1")
        expect(signing).toMatchObject({ document: null, headline: "Falta el texto del contrato de este canal." })
    })

    it("canal fuera de la firma: no dice que firme nada", () => {
        const signing = describeRowSigning(row(), { channels: [channel(21, { document: { uuid: "p21", updatedAt: null } })] }, docs, "unit-1")
        expect(signing).toMatchObject({ document: null, headline: "Este canal no está en la firma de contrato de esta unidad", channels: [] })
    })

    it("el texto que informa el backend no se pudo cargar: lo dice, sin caer en otro", () => {
        const signing = describeRowSigning(row(), { channels: [channel(23, { document: { uuid: "desconocido", updatedAt: null } })] }, docs, "unit-1")
        expect(signing.document).toBeNull()
        expect(signing.headline).toMatch(/no pudimos cargar/)
    })

    it("con el uuid del backend distingue texto propio y de la propiedad", () => {
        const own = describeRowSigning(row(), { channels: [channel(23, { document: { uuid: "u23", updatedAt: null } })] }, docs, "unit-1")
        expect(own).toMatchObject({ headline: "Firma el texto propio de esta unidad", document: { uuid: "u23" } })
        const inherited = describeRowSigning(row(), { channels: [channel(23, { document: { uuid: "p23", updatedAt: null } })] }, docs, "unit-1")
        expect(inherited).toMatchObject({ headline: "Firma el texto de la propiedad", document: { uuid: "p23" } })
    })

    it("fila general con canales que firman textos distintos: no elige uno", () => {
        const signing = describeRowSigning(row({ key: "all", channelId: null }), {
            channels: [channel(21, { document: { uuid: "general", updatedAt: null } }), channel(23, { document: { uuid: "u23", updatedAt: null } })],
        }, docs, "unit-1")
        expect(signing).toMatchObject({ document: null, headline: "Los canales firman textos distintos" })
    })

    it("solo sin `contractRouting` (backend anterior) deduce, y entonces no dice «firma»", () => {
        const signing = describeRowSigning(row(), null, docs, "unit-1")
        expect(signing).toMatchObject({ headline: "Usa el texto de la propiedad", document: { uuid: "p23" } })
    })
})
