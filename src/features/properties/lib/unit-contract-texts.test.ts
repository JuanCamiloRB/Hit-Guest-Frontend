import { describe, it, expect } from "vitest"
import { planUnitTexts } from "./unit-contract-texts"
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
