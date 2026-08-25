import { describe, expect, it } from "vitest"
import { mapGooglePlaceDetails } from "./google-place"

describe("mapGooglePlaceDetails", () => {
    it("mapea todos los componentes de una dirección australiana", () => {
        const result = mapGooglePlaceDetails({
            formattedAddress: "Unit 9, 36 Hampton Parade, West Footscray VIC 3012, Australia",
            location: { latitude: -37.7996, longitude: 144.8951 },
            addressComponents: [
                { longText: "9", types: ["subpremise"] },
                { longText: "36", types: ["street_number"] },
                { longText: "Hampton Parade", types: ["route"] },
                { longText: "West Footscray", types: ["sublocality_level_1"] },
                { longText: "Melbourne", types: ["locality"] },
                { longText: "Victoria", shortText: "VIC", types: ["administrative_area_level_1"] },
                { longText: "3012", types: ["postal_code"] },
                { longText: "Australia", shortText: "AU", types: ["country"] },
            ],
        })

        expect(result).toMatchObject({
            addressLine1: "36 Hampton Parade",
            addressLine2: "9",
            streetNumber: "36",
            streetName: "Hampton Parade",
            suburb: "West Footscray",
            city: "Melbourne",
            state: "Victoria",
            postalCode: "3012",
            countryCode: "AU",
            lat: -37.7996,
            lng: 144.8951,
        })
    })

    it("cae a postal_town cuando Google no devuelve locality", () => {
        const result = mapGooglePlaceDetails({
            addressComponents: [
                { longText: "Belfast", types: ["postal_town"] },
                { longText: "United Kingdom", shortText: "GB", types: ["country"] },
            ],
        })
        expect(result.city).toBe("Belfast")
        expect(result.countryCode).toBe("GB")
    })
})

