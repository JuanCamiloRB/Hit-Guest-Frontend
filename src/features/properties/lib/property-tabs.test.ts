import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { PROPERTY_TABS, isPropertyTab, propertyEditHref } from "./property-tabs"

describe("property-tabs", () => {
    it("la lista coincide con las pestañas reales del formulario", () => {
        // Si alguien agrega o renombra una pestaña en PropertyForm, esto falla antes
        // de que un enlace vuelva a abrir el formulario vacío.
        const source = readFileSync(join(__dirname, "../components/PropertyForm.tsx"), "utf8")
        const contents = [...source.matchAll(/<TabsContent value="([a-z]+)"/g)].map((m) => m[1])
        expect([...new Set(contents)].sort()).toEqual([...PROPERTY_TABS].sort())
    })

    it("solo acepta pestañas que existen", () => {
        expect(isPropertyTab("automations")).toBe(true)
        for (const value of ["automation", "", null, undefined, 1]) expect(isPropertyTab(value)).toBe(false)
    })

    it("arma la ruta de edición con o sin pestaña", () => {
        expect(propertyEditHref("p-1")).toBe("/dashboard/properties/p-1")
        expect(propertyEditHref("p-1", "units")).toBe("/dashboard/properties/p-1?tab=units")
    })
})
