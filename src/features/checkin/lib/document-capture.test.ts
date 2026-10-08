import { describe, expect, it } from "vitest"
import { describeUndetectedSides, readFailedSides } from "./document-capture"

describe("readFailedSides", () => {
    it("lee los lados de la forma interna unificada", () => {
        expect(readFailedSides([{ field: "back", reason: null }])).toEqual(["back"])
        expect(readFailedSides([{ field: "front", reason: "NOT_FOUND" }])).toEqual(["front"])
    })

    it("ignora los campos que no son un lado y no duplica", () => {
        expect(readFailedSides([{ field: "identificationNumber", reason: "UNCLEAR" }])).toEqual([])
        expect(readFailedSides(undefined)).toEqual([])
        expect(readFailedSides([{ field: "front", reason: null }, { field: "front", reason: null }])).toEqual(["front"])
    })
})

describe("describeUndetectedSides", () => {
    it("nombra el lado cuando hay uno solo", () => {
        expect(describeUndetectedSides(["back"])).toContain("del reverso")
        expect(describeUndetectedSides(["front"])).toContain("del frente")
    })

    it("sin lado o con los dos, habla de la foto a secas", () => {
        expect(describeUndetectedSides([])).toBe("No detectamos un documento en la foto. Toma otra con el documento completo y bien iluminado.")
        expect(describeUndetectedSides(["front", "back"])).not.toContain("del ")
    })
})
