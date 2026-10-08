import { describe, expect, it } from "vitest"
import { AUTOMATION_DEFINITIONS, isOverridableSlug, supportsListingOverride } from "../data/automation-definitions"

describe("overrides por unidad — capacidad separada de tener campos (contrato 2026-09-27)", () => {
    it("identidad se puede apagar por listing aunque no tenga parámetros", () => {
        expect(isOverridableSlug("didit")).toBe(true)
        expect(isOverridableSlug("textract")).toBe(true)
        for (const id of ["identity-verification-main", "identity-verification-secondary"]) {
            const definition = AUTOMATION_DEFINITIONS.find((def) => def.id === id)!
            expect(supportsListingOverride(definition)).toBe(true)
        }
    })

    it("los que tienen campos siguen siendo overridables; los que no tienen ni campos ni estado, no", () => {
        expect(isOverridableSlug("tra_colombia")).toBe(true)
        expect(isOverridableSlug("hitguest_signature")).toBe(false)
        expect(isOverridableSlug(null)).toBe(false)
        const contract = AUTOMATION_DEFINITIONS.find((def) => def.id === "digital-contract")!
        expect(supportsListingOverride(contract)).toBe(false)
    })
})
