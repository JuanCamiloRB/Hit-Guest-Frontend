import { describe, expect, it } from "vitest"
import { toAmenityIds, toListingPayload } from "./listing-payload"

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

describe("toAmenityIds — el round-trip asimétrico del backend", () => {
    it("los objetos enriquecidos del GET vuelven como los ids que el PUT exige", () => {
        // El caso EXACTO del warning de producción (2026-09-06): re-enviar lo
        // que el GET devolvió mandaba [{id, name}] y el backend espera [46, …].
        expect(toAmenityIds([
            { id: 46, name: "WiFi" },
            { id: 47, name: "Aire acondicionado" },
            { id: 52, name: "Cocina completa" },
        ])).toEqual([46, 47, 52])
    })

    it("tolera ids sueltos, strings y mezcla, sin duplicar", () => {
        expect(toAmenityIds([46, "47", { id: 46 }])).toEqual([46, 47])
    })

    it("la basura no produce ids fantasma", () => {
        expect(toAmenityIds([null, {}, "WiFi", -1, 0])).toEqual([])
        expect(toAmenityIds(undefined)).toEqual([])
        expect(toAmenityIds("46")).toEqual([])
    })

    it("el payload completo emite ids aunque el draft traiga los objetos del GET", () => {
        const payload = toListingPayload("property-1", {
            name: "Suite",
            roomTypeId: 16,
            extra: {
                inheritAmenities: false,
                amenities: [{ id: 46, name: "WiFi" }, { id: 76, name: "Patio o balcón" }],
            },
        })
        expect(payload.extra.amenities).toEqual([46, 76])
    })
})
