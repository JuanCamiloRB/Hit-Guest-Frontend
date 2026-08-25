import { afterEach, describe, expect, it, vi } from "vitest"
import { apiResponseToFormData, formDataToApiPayload, propertyFormSchema } from "."

afterEach(() => vi.restoreAllMocks())

describe("property address API round-trip", () => {
    it("persiste unidad separada de número y nombre de calle", () => {
        vi.spyOn(console, "log").mockImplementation(() => undefined)
        const formData = propertyFormSchema.parse({
            name: "Apto Hampton",
            email: "pm@example.com",
            address: "36 Hampton Parade",
            addressDetail: "9",
            city: "Melbourne",
            state: "Victoria",
            countryId: 1,
            latitude: -37.7996,
            longitude: 144.8951,
            statusRecordId: 6,
            propertyTypeId: 102,
        })

        expect(formDataToApiPayload(formData)).toMatchObject({
            address: "36 Hampton Parade",
            addressDetail: "9",
            city: "Melbourne",
            state: "Victoria",
            countryId: 1,
            latitude: "-37.7996",
            longitude: "144.8951",
        })
    })

    it("recupera address_detail al reabrir y no inventa Bogotá como timezone", () => {
        vi.spyOn(console, "log").mockImplementation(() => undefined)
        const result = apiResponseToFormData({
            uuid: "018cac05-1234-5678-abcd-1234567890ab",
            name: "Apto Hampton",
            email: "pm@example.com",
            address: "36 Hampton Parade",
            address_detail: "9",
            city: "Melbourne",
            state: "Victoria",
            country_id: 1,
            geo_location: "-37.7996,144.8951",
            status_record_id: 6,
            property_type_id: 102,
        })

        expect(result).toMatchObject({
            address: "36 Hampton Parade",
            addressDetail: "9",
            city: "Melbourne",
            state: "Victoria",
            countryId: 1,
            latitude: -37.7996,
            longitude: 144.8951,
            timezone: "",
        })
    })
})
