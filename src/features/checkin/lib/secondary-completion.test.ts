import { describe, expect, it } from "vitest"
import { buildSecondaryCompletionPayload } from "./secondary-completion"

describe("buildSecondaryCompletionPayload", () => {
    it("includes the editable identity fields required by the secondary contract", () => {
        const payload = buildSecondaryCompletionPayload({
            name: "Ana",
            lastname: "Ruiz",
            email: "ana@example.com",
            dateOfBirth: "1994-12-13",
            nationalityId: 48,
            identificationTypeId: 7,
            identificationNumber: "  ABC-123  ",
            identificationExpiryDate: "2030-01-01",
            dynamicExtra: { provider_field: "value" },
        })

        expect(payload.profile).toMatchObject({
            email: "ana@example.com",
            identificationTypeId: 7,
            identificationNumber: "ABC-123",
            identificationExpiryDate: "2030-01-01",
        })
        expect(payload.extra).toMatchObject({ provider_field: "value" })
    })

    it("keeps nullable secondary identity fields explicit instead of inventing values", () => {
        const payload = buildSecondaryCompletionPayload({
            name: "Ana",
            lastname: "Ruiz",
            email: "ana@example.com",
            dateOfBirth: "1994-12-13",
            nationalityId: 48,
        })

        expect(payload.profile.identificationTypeId).toBeNull()
        expect(payload.profile.identificationNumber).toBeNull()
    })
})
