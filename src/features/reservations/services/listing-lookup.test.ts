import { describe, it, expect, vi, beforeEach } from "vitest"

const listByProperty = vi.hoisted(() => vi.fn())
const listProperties = vi.hoisted(() => vi.fn())

vi.mock("@/features/properties/services/properties-service", () => ({
    propertiesService: { list: listProperties },
}))
vi.mock("@/features/properties/services/listings-service", () => ({
    listingsService: { listByProperty },
}))

import { buildListingLookup } from "./reservations-service"

const PROPERTIES = [
    { uuid: "prop-a", name: "Habitare Cristales" },
    { uuid: "prop-b", name: "Hotel Pullman" },
    { uuid: "prop-c", name: "Sitio Novo" },
]

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    listProperties.mockResolvedValue(PROPERTIES)
})

describe("buildListingLookup", () => {
    it("mapea los alojamientos de todas las propiedades", async () => {
        listByProperty.mockImplementation(async (uuid: string) => [
            { uuid: `listing-${uuid}`, name: `Unidad ${uuid}` },
        ])

        const { map, failedProperties } = await buildListingLookup()

        expect(map.size).toBe(3)
        expect(map.get("listing-prop-a")?.propertyName).toBe("Habitare Cristales")
        expect(failedProperties).toEqual([])
    })

    /**
     * El bug: con `Promise.all`, un 503 en UNA propiedad rechazaba de inmediato y
     * el mapa se devolvía a medio construir. Las propiedades que aún no habían
     * resuelto no llegaban a agregarse, así que una petición caída dejaba sin
     * propiedad a reservas de propiedades que habían respondido bien.
     */
    it("conserva las propiedades que sí respondieron cuando una falla", async () => {
        listByProperty.mockImplementation(async (uuid: string) => {
            if (uuid === "prop-b") throw new Error("Service temporarily unavailable")
            return [{ uuid: `listing-${uuid}`, name: `Unidad ${uuid}` }]
        })

        const { map, failedProperties } = await buildListingLookup()

        expect(map.has("listing-prop-a")).toBe(true)
        expect(map.has("listing-prop-c")).toBe(true)
        expect(map.has("listing-prop-b")).toBe(false)
        expect(failedProperties).toEqual(["Hotel Pullman"])
    })

    it("nombra cada propiedad caída para poder diagnosticar", async () => {
        listByProperty.mockRejectedValue(new Error("503"))

        const { map, failedProperties } = await buildListingLookup()

        expect(map.size).toBe(0)
        expect(failedProperties).toEqual(["Habitare Cristales", "Hotel Pullman", "Sitio Novo"])
    })

    it("compone el nombre de unidad con su nombre interno", async () => {
        listByProperty.mockImplementation(async (uuid: string) =>
            uuid === "prop-a" ? [{ uuid: "l1", name: "Loft Moderno", internalName: "H402" }] : [],
        )

        const { map } = await buildListingLookup()
        expect(map.get("l1")?.unitName).toBe("Loft Moderno (H402)")
    })

    it("ignora alojamientos sin uuid en vez de romper el mapa", async () => {
        listByProperty.mockImplementation(async (uuid: string) =>
            uuid === "prop-a" ? [{ name: "Sin uuid" }, { uuid: "l2", name: "Con uuid" }] : [],
        )

        const { map } = await buildListingLookup()
        expect(map.size).toBe(1)
        expect(map.has("l2")).toBe(true)
    })

    it("devuelve un mapa vacío si ni siquiera se pueden listar las propiedades", async () => {
        listProperties.mockRejectedValue(new Error("401"))

        const { map, failedProperties } = await buildListingLookup()

        expect(map.size).toBe(0)
        expect(failedProperties).toEqual([])
        expect(listByProperty).not.toHaveBeenCalled()
    })
})
