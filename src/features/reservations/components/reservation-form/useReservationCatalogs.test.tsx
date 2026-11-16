import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ listByProperty: vi.fn(), list: vi.fn(), getReservationSources: vi.fn() }))

vi.mock("@/features/properties/services/properties-service", () => ({ propertiesService: { list: mocks.list } }))
vi.mock("@/features/properties/services/listings-service", () => ({ listingsService: { listByProperty: mocks.listByProperty } }))
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getReservationSources: mocks.getReservationSources, getCountries: async () => [], getCurrencies: async () => [] },
}))

import { useReservationCatalogs } from "./useReservationCatalogs"

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
}

describe("useReservationCatalogs — alojamientos: solo escribe la última petición", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("cambiar rápido de propiedad: la respuesta tardía de la anterior se descarta", async () => {
        const slow = deferred<unknown[]>()
        mocks.listByProperty.mockImplementation((uuid: string) =>
            uuid === "p-a" ? slow.promise : Promise.resolve([{ uuid: "l-b", name: "Casa B", propertyUuid: "p-b", statusRecord: { id: 6 } }]))
        const { result } = renderHook(() => useReservationCatalogs())

        act(() => { void result.current.loadListings("p-a") })
        act(() => { void result.current.loadListings("p-b") })
        await waitFor(() => expect(result.current.listings.map((l) => l.uuid)).toEqual(["l-b"]))
        expect(result.current.loading.listings).toBe(false)

        await act(async () => {
            slow.resolve([{ uuid: "l-a", name: "Casa A", propertyUuid: "p-a", statusRecord: { id: 6 } }])
            await Promise.resolve()
        })
        expect(result.current.listings.map((l) => l.uuid)).toEqual(["l-b"])
    })

    it("un alojamiento de OTRA propiedad se descarta; uno sin referencia se conserva", async () => {
        mocks.listByProperty.mockResolvedValue([
            { uuid: "l-1", name: "Mío", propertyUuid: "p-1", statusRecordId: 6 },
            { uuid: "l-2", name: "Ajeno", property_uuid: "p-2", statusRecordId: 6 },
            { uuid: "l-3", name: "Sin ref", statusRecordId: 6 },
        ])
        const { result } = renderHook(() => useReservationCatalogs())
        await act(async () => { await result.current.loadListings("p-1") })
        expect(result.current.listings.map((l) => l.uuid)).toEqual(["l-1", "l-3"])
    })

    it("cada catálogo tiene su propia espera", async () => {
        const props = deferred<unknown[]>()
        mocks.list.mockReturnValue(props.promise)
        mocks.getReservationSources.mockResolvedValue([{ id: "21", name: "Directo" }])
        const { result } = renderHook(() => useReservationCatalogs())
        act(() => { result.current.loadAll() })
        await waitFor(() => expect(result.current.sources).toHaveLength(1))
        expect(result.current.loading.properties).toBe(true)
        expect(result.current.loading.sources).toBe(false)
        await act(async () => { props.resolve([]); await Promise.resolve() })
        expect(result.current.loading.properties).toBe(false)
    })

    it("canales sin id numérico o catálogo caído: `sourcesFailed`, sin inventar ids", async () => {
        mocks.getReservationSources.mockResolvedValue([{ id: "uuid-x", name: "Directo" }])
        const { result } = renderHook(() => useReservationCatalogs())
        let ok = true
        await act(async () => { ok = await result.current.loadSources() })
        expect(ok).toBe(false)
        expect(result.current.sourcesFailed).toBe(true)
        expect(result.current.sources).toEqual([])
    })
})
