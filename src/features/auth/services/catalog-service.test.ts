import { describe, expect, it } from "vitest"
import { normalizeCountryTimezones } from "./catalog-service"

describe("normalizeCountryTimezones", () => {
    it("normaliza la respuesta documentada de países", () => {
        expect(normalizeCountryTimezones([
            { zoneName: "Australia/Melbourne", gmtOffset: 36000 },
            { zoneName: "Australia/Perth", gmtOffset: 28800 },
        ])).toEqual(["Australia/Melbourne", "Australia/Perth"])
    })

    it("acepta strings, elimina vacíos y deduplica", () => {
        expect(normalizeCountryTimezones([
            "America/Bogota",
            " America/Bogota ",
            "",
            null,
        ])).toEqual(["America/Bogota"])
    })
})

