import { describe, expect, it } from "vitest"
import { readPropertyTypeId } from "./property-type"

describe("readPropertyTypeId — sin tipo inventado", () => {
    it("lee el id del objeto anidado, del campo plano (camel o snake) o de extra", () => {
        expect(readPropertyTypeId({ propertyType: { id: 106, name: "House" } })).toBe(106)
        expect(readPropertyTypeId({ propertyTypeId: 103 })).toBe(103)
        expect(readPropertyTypeId({ property_type_id: "104" })).toBe(104)
        expect(readPropertyTypeId({ extra: { propertyTypeId: 105 } })).toBe(105)
    })

    it("sin tipo informado devuelve null — nunca 102, que en el catálogo real es Hotel", () => {
        expect(readPropertyTypeId({ name: "Apto importado de Kunas" })).toBeNull()
        expect(readPropertyTypeId({ propertyTypeId: null, property_type_id: 0 })).toBeNull()
    })

    it("ignora el enum de texto que el front viejo escribía en extra.type", () => {
        expect(readPropertyTypeId({ extra: { type: "HOTEL" } })).toBeNull()
    })
})

describe("apiResponseToFormData — el formulario no completa el tipo", () => {
    it("una propiedad sin tipo queda en 0 y la validación pide elegirlo", async () => {
        const { apiResponseToFormData, propertyFormSchema } = await import("../types")
        const form = apiResponseToFormData({ uuid: "p-1", name: "Apto Kunas" } as never)
        expect(form.propertyTypeId).toBe(0)
        const result = propertyFormSchema.shape.propertyTypeId.safeParse(form.propertyTypeId)
        expect(result.success).toBe(false)
    })

    it("con tipo informado lo conserva tal cual", async () => {
        const { apiResponseToFormData } = await import("../types")
        expect(apiResponseToFormData({ uuid: "p-2", propertyTypeId: 106 } as never).propertyTypeId).toBe(106)
    })
})
