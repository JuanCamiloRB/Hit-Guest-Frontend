import { describe, it, expect } from "vitest"
import { toPlaceId, isNominatimPlaceId, mapPlaceDetails } from "./nominatim"

describe("toPlaceId", () => {
    it("usa la inicial del tipo OSM, que es lo que acepta `lookup`", () => {
        expect(toPlaceId({ osm_type: "way", osm_id: 123 })).toBe("W123")
        expect(toPlaceId({ osm_type: "node", osm_id: 456 })).toBe("N456")
        expect(toPlaceId({ osm_type: "relation", osm_id: 789 })).toBe("R789")
    })

    it("acepta el id como cadena", () => {
        expect(toPlaceId({ osm_type: "way", osm_id: "123" })).toBe("W123")
    })

    it("descarta lo que no se podría resolver después", () => {
        expect(toPlaceId({ osm_id: 123 })).toBeNull()
        expect(toPlaceId({ osm_type: "way" })).toBeNull()
        expect(toPlaceId({ osm_type: "xyz", osm_id: 1 })).toBeNull()
        expect(toPlaceId({ osm_type: "way", osm_id: "" })).toBeNull()
    })
})

describe("isNominatimPlaceId", () => {
    it("acepta solo la forma que `lookup` entiende", () => {
        expect(isNominatimPlaceId("W123")).toBe(true)
        expect(isNominatimPlaceId("N1")).toBe(true)
    })

    it("rechaza un placeId de Google, que iría a otro proveedor", () => {
        // Evita reenviar a Nominatim un id que no es suyo.
        expect(isNominatimPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4")).toBe(false)
        expect(isNominatimPlaceId("W12a")).toBe(false)
        expect(isNominatimPlaceId("")).toBe(false)
    })
})

describe("mapPlaceDetails", () => {
    it("convierte las coordenadas, que Nominatim manda como texto", () => {
        const d = mapPlaceDetails({ lat: "-37.7996", lon: "144.8951" })
        expect(d.lat).toBeCloseTo(-37.7996)
        expect(d.lng).toBeCloseTo(144.8951)
    })

    it("deja las coordenadas en null si no son numéricas", () => {
        expect(mapPlaceDetails({ lat: "abc", lon: "" })).toMatchObject({ lat: null, lng: null })
        expect(mapPlaceDetails({})).toMatchObject({ lat: null, lng: null })
    })

    it("pasa el país a MAYÚSCULAS para que case con el catálogo", () => {
        // Nominatim devuelve "au"; el catálogo compara contra el ISO2 de Google,
        // que viene en mayúsculas. Sin esto el país no casa y la zona horaria no
        // se autocompleta.
        expect(mapPlaceDetails({ address: { country_code: "au" } }).countryCode).toBe("AU")
        expect(mapPlaceDetails({ address: { country_code: "co" } }).countryCode).toBe("CO")
    })

    it("busca la ciudad en cascada: no todas las localidades usan `city`", () => {
        expect(mapPlaceDetails({ address: { city: "Cali" } }).city).toBe("Cali")
        expect(mapPlaceDetails({ address: { town: "Footscray" } }).city).toBe("Footscray")
        expect(mapPlaceDetails({ address: { village: "Tullamarine" } }).city).toBe("Tullamarine")
        expect(mapPlaceDetails({ address: { suburb: "Footscray" } }).city).toBe("Footscray")
    })

    it("prefiere `city` cuando vienen varias claves a la vez", () => {
        const d = mapPlaceDetails({ address: { city: "Melbourne", suburb: "Footscray" } })
        expect(d.city).toBe("Melbourne")
    })

    it("no revienta con una respuesta vacía", () => {
        expect(mapPlaceDetails({})).toEqual({
            lat: null,
            lng: null,
            formattedAddress: "",
            addressLine1: "",
            addressLine2: "",
            streetNumber: "",
            streetName: "",
            city: "",
            suburb: "",
            state: "",
            postalCode: "",
            countryCode: "",
        })
    })

    it("mapea un resultado real australiano de punta a punta", () => {
        const d = mapPlaceDetails({
            lat: "-37.79961",
            lon: "144.89513",
            display_name: "188 Ballarat Road, Footscray, Victoria, 3011, Australia",
            address: {
                unit: "907",
                house_number: "188",
                road: "Ballarat Road",
                suburb: "Footscray",
                state: "Victoria",
                postcode: "3011",
                country_code: "au",
            },
        })
        expect(d).toMatchObject({
            addressLine1: "188 Ballarat Road",
            addressLine2: "907",
            streetNumber: "188",
            streetName: "Ballarat Road",
            city: "Footscray",
            suburb: "Footscray",
            state: "Victoria",
            postalCode: "3011",
            countryCode: "AU",
            formattedAddress: "188 Ballarat Road, Footscray, Victoria, 3011, Australia",
        })
        expect(d.lat).toBeCloseTo(-37.79961)
    })
})
