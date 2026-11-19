import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ bffFetch: vi.fn() }))
vi.mock("@/lib/bff-client", () => ({ bffFetch: mocks.bffFetch }))

import { readAutomationSlugs, invalidatePropertiesCaches, portfolioCache, propertiesCache, resetPropertiesCaches } from "./properties-cache"

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
    it("sin capacidad declarada o en 0 es `null` (no un 2 inventado); un número en texto se respeta", async () => {
        const { toListing } = await import("./properties-cache")
        expect(toListing({ uuid: "l1", extra: {} }, 0).capacity).toBeNull()
        expect(toListing({ uuid: "l1", extra: { maxOccupancy: 0 } }, 0).capacity).toBeNull()
        expect(toListing({ uuid: "l1", extra: { maxOccupancy: "4" } }, 0).capacity).toBe(4)
    })

    // Un 0 NO es «gratis»: el diálogo de alojamiento guarda `Number(price) || 0`, así que
    // todo alojamiento sin precio llega como 0 (17 de 29 en la cuenta real). Mientras el
    // formulario escriba 0 para «vacío», 0 se lee como «sin precio». Si algún día se
    // quiere «Sin costo» de verdad, primero hay que dejar de escribir 0 por omisión.
    it("precio: 0 o ausente es `null` (el formulario guarda 0 cuando el PM lo deja vacío); la moneda sale de `extra.currency` en mayúsculas, o `null`", async () => {
        const { toListing } = await import("./properties-cache")
        expect(toListing({ uuid: "l1", extra: {} }, 0)).toMatchObject({ pricePerNight: null, currency: null })
        expect(toListing({ uuid: "l1", price: 0, extra: { currency: "cop" } }, 0)).toMatchObject({ pricePerNight: null, currency: "COP" })
        expect(toListing({ uuid: "l1", extra: { startPrice: "850000", currency: "COP" } }, 0)).toMatchObject({ pricePerNight: 850000, currency: "COP" })
        expect(toListing({ uuid: "l1", price: 150, currency: "USD", extra: {} }, 0)).toMatchObject({ pricePerNight: 150, currency: "USD" })
    })

    it("activo si cualquiera de las formas del estado lo dice", async () => {
        const { toListing } = await import("./properties-cache")
        expect(toListing({ uuid: "l1", statusRecordId: 7, statusRecord: { id: 6 } }, 0).status).toBe("ACTIVE")
        expect(toListing({ uuid: "l1", status_record_id: 6 }, 0).status).toBe("ACTIVE")
        expect(toListing({ uuid: "l1", statusRecordId: 7 }, 0).status).toBe("INACTIVE")
    })
})

describe("readAutomationSlugs — qué proveedores usa la cuenta", () => {
    it("une los slugs ACTIVOS de todas las propiedades, normalizados; apagados en todas no cuentan", () => {
        const slugs = readAutomationSlugs({ automationsByProperty: {
            p1: [{ providerSlug: "tra_colombia", statusProviderId: 8 }, { providerSlug: "Hitguest-Signature", statusProviderId: 8 }],
            p2: [{ providerSlug: "sire_colombia", statusProviderId: 10 }, { providerSlug: "tra_colombia", statusProviderId: 10 }],
        } })
        // SIRE solo está apagado (10): no cuenta como usado.
        expect([...slugs!].sort()).toEqual(["hitguest_signature", "tra_colombia"])
    })

    it("una propiedad cuya consulta falló (null) o un agregado sin el mapa: null, no «nada configurado»", () => {
        expect(readAutomationSlugs({ automationsByProperty: { p1: [{ providerSlug: "tra_colombia", statusProviderId: 8 }], p2: null } })).toBeNull()
        expect(readAutomationSlugs({})).toBeNull()
    })
})
