import { afterEach, describe, expect, it, vi } from "vitest"
import { CatalogService, normalizeCountryTimezones } from "./catalog-service"

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


describe("catalogService — el `slug` del backend llega a CatalogOption (logos del origen)", () => {
    afterEach(() => vi.unstubAllGlobals())

    function respond(rows: unknown[]) {
        return vi.fn(async () => new Response(JSON.stringify({ data: rows }), { status: 200 }))
    }

    it("por id de categoría (getPmsSources → 12): conserva el slug aunque el nombre esté renombrado", async () => {
        vi.stubGlobal("fetch", respond([
            { id: 100, name: "Hospedaje asociado", slug: "airbnb" },
            { id: 134, name: "KunasPMS" },
        ]))
        const sources = await new CatalogService().getPmsSources()
        expect(sources).toEqual([
            { id: "100", name: "Hospedaje asociado", slug: "airbnb" },
            // Sin slug no se inventa uno: la clave ni aparece.
            { id: "134", name: "KunasPMS" },
        ])
    })

    it("por nombre de categoría (fetchCatalog): conserva el slug igual", async () => {
        vi.stubGlobal("fetch", respond([
            { id: 100, name: "Hospedaje asociado", slug: "airbnb" },
            { id: 7, name: "Cédula", slug: "" },
        ]))
        const types = await new CatalogService().getIdentificationTypes()
        expect(types).toEqual([
            { id: "100", name: "Hospedaje asociado", slug: "airbnb" },
            { id: "7", name: "Cédula" },
        ])
    })
})
