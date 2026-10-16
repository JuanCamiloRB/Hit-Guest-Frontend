import { describe, expect, it } from "vitest"
import { draftOverrideCreatePayload, isMeaningfulOverride } from "./PropertiesUnits"
import type { ListingAutomationOverride } from "../types/automation"

const draft = (over: Partial<ListingAutomationOverride> = {}): ListingAutomationOverride => ({
    uuid: "", listingUuid: "", propertyAutomationUuid: "identity-main", parameters: null, token: null,
    statusRecordId: 6, deletedAt: null, isActive: true, ...over,
})

describe("borradores de override en una unidad nueva (contrato 2026-10-14)", () => {
    it("un nivel de identidad propio es configuración real, aunque no haya parámetros", () => {
        expect(isMeaningfulOverride(draft({ providerId: 502, providerSource: "listing" }))).toBe(true)
        expect(isMeaningfulOverride(draft())).toBe(false)
    })

    it("el POST lleva el proveedor elegido solo con estado 6", () => {
        expect(draftOverrideCreatePayload(draft({ providerId: 502 }), "unit-9")).toEqual({
            listingUuid: "unit-9", propertyAutomationUuid: "identity-main", statusRecordId: 6, parameters: null, providerId: 502,
        })
        expect(draftOverrideCreatePayload(draft({ statusRecordId: 7, isActive: false, providerId: 502 }), "unit-9")).not.toHaveProperty("providerId")
    })
})
