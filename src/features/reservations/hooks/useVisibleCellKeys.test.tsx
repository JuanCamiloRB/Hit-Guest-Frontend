import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"
import { useVisibleCellKeys } from "./useVisibleCellKeys"

describe("useVisibleCellKeys — identidad estable", () => {
    it("filas nuevas con el mismo resultado devuelven el MISMO arreglo; un cambio real, uno nuevo", () => {
        const slugs = new Set(["tra_colombia"])
        const { result, rerender } = renderHook(({ rows }) => useVisibleCellKeys(slugs, rows), { initialProps: { rows: [] as never[] } })
        const first = result.current
        expect(first).toEqual(["link", "checkin", "tra"])
        // Otra instancia de filas, mismas claves: la tabla no debe rehacer sus columnas.
        rerender({ rows: [] as never[] })
        expect(result.current).toBe(first)
        rerender({ rows: [{ automationItems: [{ providerSlug: "ttlock", automationName: "Smart Lock Codes", status: "completed" }] }] as never[] })
        expect(result.current).not.toBe(first)
        expect(result.current).toEqual(["link", "checkin", "code", "tra"])
    })
})
