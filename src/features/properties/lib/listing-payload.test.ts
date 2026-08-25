import { describe, expect, it } from "vitest"
import { toListingPayload } from "./listing-payload"

describe("toListingPayload", () => {
    it("removes UI inheritance flags and omits inherited values", () => {
        const payload = toListingPayload("property-1", {
            name: " Suite 101 ",
            roomTypeId: 16,
            price: "250000",
            extra: {
                currency: "COP",
                inheritWifi: true,
                inheritSchedule: true,
                inheritPolicies: true,
                inheritAmenities: true,
                amenities: [],
                wifiDetails: { network: "draft" },
                checkIn: "15:00",
                checkOut: "11:00",
                cancellationPolicy: "STANDARD",
            },
        })

        expect(payload.name).toBe("Suite 101")
        expect(payload.extra).toEqual({ currency: "COP", startPrice: 250000 })
    })

    it("persists explicit overrides and normalizes optional text", () => {
        const payload = toListingPayload("property-1", {
            name: "Suite",
            roomTypeId: "16",
            internalName: "  S-101  ",
            description: "   ",
            contactEmail: " host@example.com ",
            isActive: false,
            externalPmsIds: [{ sourcePmsId: 100, externalId: " external-1 " }],
            extra: {
                inheritWifi: false,
                inheritSchedule: false,
                inheritPolicies: false,
                inheritAmenities: false,
                amenities: [46, 50],
                wifiDetails: { network: "Private" },
                checkIn: "14:00",
                checkOut: "10:00",
                cancellationPolicy: "FLEXIBLE",
            },
        })

        expect(payload).toMatchObject({
            propertyUuid: "property-1",
            roomTypeId: 16,
            internalName: "S-101",
            description: undefined,
            contactEmail: "host@example.com",
            statusRecordId: 7,
            externalPmsIds: [{ sourcePmsId: 100, externalId: "external-1" }],
            extra: {
                wifiDetails: { network: "Private" },
                checkIn: "14:00",
                checkOut: "10:00",
                cancellationPolicy: "FLEXIBLE",
                amenities: [46, 50],
                startPrice: 0,
            },
        })
    })
})
