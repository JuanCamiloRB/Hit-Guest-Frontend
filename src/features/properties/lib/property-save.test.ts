import { describe, expect, it, vi } from "vitest"
import { createListingWithOverrideDrafts, createPropertyWithUnits, readCreatedPropertyUuid, tabAfterCreate, withExternalIdsGating } from "./property-save"
import type { PropertyFormData } from "../types"
import type { ListingAutomationOverride } from "../types/automation"

/** Fase 0: la secuencia propiedad → alojamientos y sus reglas, congeladas. */

const unit = (name: string, extra: Partial<{ externalPmsIds: unknown[] }> = {}) => ({
    name, internalName: "", roomTypeId: 7, thumbnailUrl: "", contactName: "", contactEmail: "a@b.co", contactPhone: "",
    isActive: true, price: "100", extra: { currency: "COP" }, externalPmsIds: [], ...extra,
})

const values = { name: "Casa", units: [unit("Suite 101"), unit("Suite 102", { externalPmsIds: [{ sourcePmsId: 134, externalId: "X" }] }), unit("")] } as unknown as PropertyFormData

describe("withExternalIdsGating", () => {
    it("sin editar la sección, la clave se omite; editada, viaja (aunque sea [])", () => {
        const v = { name: "x", externalPmsIds: [] } as unknown as PropertyFormData
        expect(withExternalIdsGating(v, false).externalPmsIds).toBeUndefined()
        expect(withExternalIdsGating(v, true).externalPmsIds).toEqual([])
    })
})

describe("readCreatedPropertyUuid", () => {
    it("acepta el uuid en la raíz o en data; nada más", () => {
        expect(readCreatedPropertyUuid({ uuid: "p-1" })).toBe("p-1")
        expect(readCreatedPropertyUuid({ data: { uuid: "p-2" } })).toBe("p-2")
        expect(readCreatedPropertyUuid({ data: {} })).toBeNull()
        expect(readCreatedPropertyUuid(null)).toBeNull()
    })
})

describe("createPropertyWithUnits — orden y recuperación", () => {
    it("crea la propiedad, invalida cachés y después cada alojamiento EN SECUENCIA con el uuid nuevo", async () => {
        const order: string[] = []
        const createProperty = vi.fn(async () => { order.push("property"); return { uuid: "p-9" } })
        const createListing = vi.fn(async (payload: { name?: string; propertyUuid?: string }) => { order.push("listing:" + payload.name); return {} })
        const onPropertyCreated = vi.fn(() => order.push("cache"))
        const result = await createPropertyWithUnits({ values, submitValues: values, createProperty, onPropertyCreated, createListing })

        expect(order).toEqual(["property", "cache", "listing:Suite 101", "listing:Suite 102", "listing:"])
        expect(createListing.mock.calls.every(([p]) => p.propertyUuid === "p-9")).toBe(true)
        expect(result).toEqual({ propertyUuid: "p-9", failedUnits: [], pendingUnits: 3 })
    })

    it("sin identificadores externos la clave no se manda; con ellos sí", async () => {
        const createListing = vi.fn<(payload: { externalPmsIds?: unknown }) => Promise<unknown>>(async () => ({}))
        await createPropertyWithUnits({ values, submitValues: values, createProperty: async () => ({ uuid: "p-9" }), createListing })
        const [first, second] = createListing.mock.calls.map(([p]) => p)
        expect("externalPmsIds" in first).toBe(false)
        expect(second.externalPmsIds).toEqual([{ sourcePmsId: 134, externalId: "X" }])
    })

    it("un alojamiento que falla no detiene a los demás: se anota por nombre (o «Unidad N») y se va a la pestaña de alojamientos", async () => {
        const createListing = vi.fn()
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error("422"))
            .mockRejectedValueOnce(new Error("500"))
        const onListingError = vi.fn()
        const result = await createPropertyWithUnits({ values, submitValues: values, createProperty: async () => ({ uuid: "p-9" }), createListing, onListingError })
        expect(createListing).toHaveBeenCalledTimes(3)
        expect(result.failedUnits).toEqual(["Suite 102", "Unidad 3"])
        expect(onListingError).toHaveBeenCalledTimes(2)
        expect(tabAfterCreate(result.failedUnits)).toBe("units")
        expect(tabAfterCreate([])).toBe("automations")
    })

    it("sin uuid en la respuesta no se crea ningún alojamiento y el error lo dice", async () => {
        const createListing = vi.fn()
        await expect(createPropertyWithUnits({ values, submitValues: values, createProperty: async () => ({ ok: true }), createListing }))
            .rejects.toThrow("El backend creó la propiedad sin devolver su UUID.")
        expect(createListing).not.toHaveBeenCalled()
    })

    it("la propiedad se crea con los valores filtrados (gating), pero los alojamientos salen de los valores originales", async () => {
        const createProperty = vi.fn(async () => ({ uuid: "p-9" }))
        const submitValues = { ...values, externalPmsIds: undefined }
        await createPropertyWithUnits({ values, submitValues, createProperty, createListing: async () => ({}) })
        expect(createProperty).toHaveBeenCalledWith(submitValues)
    })
})

describe("createListingWithOverrideDrafts — alojamiento nuevo en propiedad existente", () => {
    const payload = { propertyUuid: "p-1", name: "Suite 101", roomTypeId: 7, statusRecordId: 6, extra: {} } as unknown as Parameters<typeof createListingWithOverrideDrafts>[0]["payload"]
    const draft = (uuid: string, name?: string) => ({
        uuid: "", listingUuid: "", propertyAutomationUuid: uuid, parameters: { token: "x" }, token: null,
        statusRecordId: 6, deletedAt: null, isActive: true,
        propertyAutomation: name ? { uuid, name, parameters: null, provider: null } : null,
    }) as unknown as ListingAutomationOverride

    it("POST del alojamiento, luego el aviso de creado, luego cada override EN SECUENCIA con el uuid nuevo", async () => {
        const order: string[] = []
        const createListing = vi.fn(async () => { order.push("listing"); return { data: { uuid: "l-9", name: "Suite 101" } } })
        const onListingCreated = vi.fn((_apiData: unknown, uuid: string) => order.push("created:" + uuid))
        const createOverride = vi.fn(async (d: ListingAutomationOverride, uuid: string) => { order.push("override:" + d.propertyAutomationUuid + "@" + uuid); return {} })
        const result = await createListingWithOverrideDrafts({ payload, drafts: [draft("tra", "TRA"), draft("sire")], createListing, onListingCreated, createOverride })

        expect(order).toEqual(["listing", "created:l-9", "override:tra@l-9", "override:sire@l-9"])
        expect(createListing).toHaveBeenCalledWith(payload)
        expect(result).toEqual({ apiData: { uuid: "l-9", name: "Suite 101" }, listingUuid: "l-9", failedOverrides: [] })
    })

    it("un override que falla no detiene a los demás: se anota por nombre (o por uuid si no lo tiene)", async () => {
        const createOverride = vi.fn().mockRejectedValueOnce(new Error("422")).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("500"))
        const result = await createListingWithOverrideDrafts({
            payload, drafts: [draft("tra", "TRA"), draft("pdf", "Reporte"), draft("sire")],
            createListing: async () => ({ uuid: "l-9" }), createOverride,
        })
        expect(createOverride).toHaveBeenCalledTimes(3)
        expect(result.failedOverrides).toEqual(["TRA", "sire"])
    })

    it("sin borradores no se llama a overrides; sin uuid en la respuesta no se crea ninguno y el error lo dice", async () => {
        const createOverride = vi.fn()
        await createListingWithOverrideDrafts({ payload, drafts: [], createListing: async () => ({ uuid: "l-9" }), createOverride })
        expect(createOverride).not.toHaveBeenCalled()
        await expect(createListingWithOverrideDrafts({ payload, drafts: [draft("tra")], createListing: async () => ({ ok: true }), createOverride }))
            .rejects.toThrow("El backend creó la unidad sin devolver su UUID.")
        expect(createOverride).not.toHaveBeenCalled()
    })

    it("invariante: al crear una PROPIEDAD no hay overrides (createPropertyWithUnits no los recibe ni los llama)", async () => {
        const createListing = vi.fn(async (payload: { propertyUuid?: string }) => { void payload; return {} })
        const result = await createPropertyWithUnits({ values, submitValues: values, createProperty: async () => ({ uuid: "p-9" }), createListing })
        expect(result).not.toHaveProperty("failedOverrides")
        expect(createListing.mock.calls.every(([p]) => !("listingOverrides" in (p as object)))).toBe(true)
    })
})
