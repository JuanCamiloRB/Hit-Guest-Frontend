import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getPropertyTypes = vi.fn()
vi.mock("@/features/auth/services/catalog-service", () => ({
    catalogService: { getPropertyTypes: () => getPropertyTypes() },
}))

describe("usePropertyTypeLabel — un fallo del catálogo no queda guardado", () => {
    beforeEach(() => {
        vi.resetModules()
        getPropertyTypes.mockReset()
    })

    it("tras un catálogo vacío (el fallo que devuelve el servicio) el siguiente montaje reintenta", async () => {
        getPropertyTypes
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: "102", name: "Hotel" }, { id: "106", name: "Casa" }])
        const { usePropertyTypeLabel } = await import("./usePropertyTypeLabel")

        const first = renderHook(() => usePropertyTypeLabel("106"))
        await waitFor(() => expect(getPropertyTypes).toHaveBeenCalledTimes(1))
        expect(first.result.current).toBeNull()
        first.unmount()

        const second = renderHook(() => usePropertyTypeLabel("106"))
        await waitFor(() => expect(second.result.current).toBe("Casa"))
        expect(getPropertyTypes).toHaveBeenCalledTimes(2)
    })
})
