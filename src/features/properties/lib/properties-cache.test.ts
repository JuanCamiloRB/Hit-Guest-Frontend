import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ bffFetch: vi.fn() }))
vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))

import { invalidatePropertiesCaches, portfolioCache, propertiesCache, resetPropertiesCaches } from "./properties-cache"

const rawProperty = (uuid: string, statusRecordId = 6) => ({ uuid, name: `Propiedad ${uuid}`, statusRecordId, extra: {} })
const rawListing = (uuid: string, propertyUuid: string, statusRecordId = 6) => ({ uuid, name: `Unidad ${uuid}`, _propertyUuid: propertyUuid, statusRecordId, extra: {} })

describe("properties-cache", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetPropertiesCaches()
    })

    it("propiedades: el endpoint liviano mapeado con el mismo conversor que el portafolio", async () => {
        mocks.bffFetch.mockResolvedValueOnce({ data: [rawProperty("p1"), rawProperty("p2", 7)] })
        const properties = await propertiesCache.load()
        expect(mocks.bffFetch).toHaveBeenCalledWith("/api/bff/properties")
        expect(properties.map((p) => [p.uuid, p.status])).toEqual([["p1", "ACTIVE"], ["p2", "INACTIVE"]])
    })

    it("portafolio: cuenta solo alojamientos activos y no inventa insignias si las automatizaciones fallaron", async () => {
        mocks.bffFetch.mockResolvedValueOnce({
            properties: [rawProperty("p1"), rawProperty("p2")],
            listings: [rawListing("l1", "p1"), rawListing("l2", "p1", 7), rawListing("l3", "p2")],
            automationsByProperty: { p1: [], p2: null },
        })
        const portfolio = await portfolioCache.load()

        expect(mocks.bffFetch).toHaveBeenCalledWith("/api/bff/properties-with-listings")
        expect(portfolio.listings).toHaveLength(3)
        expect(portfolio.overview.p1.activeListings).toBe(1)
        expect(portfolio.overview.p2.activeListings).toBe(1)
        expect(portfolio.overview.p2.badges).toBeNull()
    })

    it("tras una mutación, invalidar deja las dos cachés vacías para que la próxima pantalla arranque limpia", async () => {
        mocks.bffFetch
            .mockResolvedValueOnce({ data: [rawProperty("p1")] })
            .mockResolvedValueOnce({ properties: [], listings: [] })
        await propertiesCache.load()
        await portfolioCache.load()

        invalidatePropertiesCaches()
        expect(propertiesCache.read()).toBeNull()
        expect(portfolioCache.read()).toBeNull()
    })
})

describe("toListing — misma lectura que siempre tuvo la tabla de alojamientos", () => {
    it("sin capacidad declarada o en 0 asume 2; un número en texto se respeta", async () => {
        const { toListing } = await import("./properties-cache")
        expect(toListing({ uuid: "l1", extra: {} }, 0).capacity).toBe(2)
        expect(toListing({ uuid: "l1", extra: { maxOccupancy: 0 } }, 0).capacity).toBe(2)
        expect(toListing({ uuid: "l1", extra: { maxOccupancy: "4" } }, 0).capacity).toBe(4)
    })

    it("activo si cualquiera de las formas del estado lo dice", async () => {
        const { toListing } = await import("./properties-cache")
        expect(toListing({ uuid: "l1", statusRecordId: 7, statusRecord: { id: 6 } }, 0).status).toBe("ACTIVE")
        expect(toListing({ uuid: "l1", status_record_id: 6 }, 0).status).toBe("ACTIVE")
        expect(toListing({ uuid: "l1", statusRecordId: 7 }, 0).status).toBe("INACTIVE")
    })
})
