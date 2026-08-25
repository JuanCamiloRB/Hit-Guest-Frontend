import { describe, expect, it } from "vitest"
import {
    formatSuggestion,
    mergeTypedAddress,
    parseTypedAddress,
    toGeocoderQuery,
    type GeocodePlaceDetails,
} from "./address"

const routeOnly: GeocodePlaceDetails = {
    lat: -37.7996,
    lng: 144.8951,
    formattedAddress: "Hampton Parade, West Footscray VIC 3012, Australia",
    addressLine1: "Hampton Parade",
    addressLine2: "",
    streetNumber: "",
    streetName: "Hampton Parade",
    city: "Melbourne",
    suburb: "West Footscray",
    state: "Victoria",
    postalCode: "3012",
    countryCode: "AU",
}

describe("parseTypedAddress", () => {
    it("separa unidad, número y calle del formato australiano con slash", () => {
        expect(parseTypedAddress(" 9 / 36   Hampton Parade ")).toEqual({
            unit: "9",
            streetNumber: "36",
            streetName: "Hampton Parade",
        })
        expect(parseTypedAddress("907/188 Ballarat Road")).toEqual({
            unit: "907",
            streetNumber: "188",
            streetName: "Ballarat Road",
        })
    })

    it("reconoce etiquetas de unidad sin depender del idioma", () => {
        expect(parseTypedAddress("Unit 9, 36 Hampton Parade")).toEqual({
            unit: "9",
            streetNumber: "36",
            streetName: "Hampton Parade",
        })
        expect(parseTypedAddress("Apto. 501 Carrera 7 # 72-41")).toEqual({
            unit: "501",
            streetNumber: "",
            streetName: "Carrera 7 # 72-41",
        })
    })

    it("no interpreta el número de una carrera colombiana como número de puerta", () => {
        expect(parseTypedAddress("Carrera 7 # 72-41")).toEqual({
            unit: "",
            streetNumber: "",
            streetName: "Carrera 7 # 72-41",
        })
    })
})

describe("toGeocoderQuery", () => {
    it("quita solo la unidad antes de consultar al proveedor mundial", () => {
        expect(toGeocoderQuery("907/188 Ballarat Rd Footscray"))
            .toBe("188 Ballarat Rd Footscray")
        expect(toGeocoderQuery("Unit 9, 36 Hampton Parade"))
            .toBe("36 Hampton Parade")
    })

    it("conserva formatos que no puede separar con seguridad", () => {
        expect(toGeocoderQuery("Carrera 7 # 72-41, Bogotá"))
            .toBe("Carrera 7 # 72-41, Bogotá")
        expect(toGeocoderQuery("10 Downing Street, London"))
            .toBe("10 Downing Street, London")
    })
})

describe("mergeTypedAddress", () => {
    it("recupera unidad y número cuando el proveedor devuelve solo la calle", () => {
        expect(mergeTypedAddress(routeOnly, "9/36 hampton parade")).toMatchObject({
            addressLine1: "36 Hampton Parade",
            addressLine2: "9",
            streetNumber: "36",
            streetName: "Hampton Parade",
        })
    })

    it("prefiere componentes verificados del proveedor y no duplica números", () => {
        const resolved = {
            ...routeOnly,
            addressLine1: "38 Hampton Parade",
            streetNumber: "38",
            addressLine2: "12",
        }
        expect(mergeTypedAddress(resolved, "9/36 Hampton Parade")).toMatchObject({
            addressLine1: "38 Hampton Parade",
            addressLine2: "12",
        })
    })
})

describe("formatSuggestion", () => {
    it("hace visible el premise que Nominatim omite", () => {
        expect(formatSuggestion("Hampton Parade, West Footscray", "9/36 hampton parade"))
            .toBe("9/36 Hampton Parade, West Footscray")
        expect(formatSuggestion("188 Ballarat Road, Footscray", "907/188 ballarat"))
            .toBe("907/188 Ballarat Road, Footscray")
    })

    it("no duplica el premise si el proveedor ya lo incluyó", () => {
        expect(formatSuggestion("9/36 Hampton Parade, West Footscray", "9/36 Hampton Parade"))
            .toBe("9/36 Hampton Parade, West Footscray")
    })
})
