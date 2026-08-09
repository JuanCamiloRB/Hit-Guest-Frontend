import { describe, it, expect } from "vitest"
import { buildTrafficLight } from "./reservations-service"
import type { AutomationStatusItem } from "@/features/properties/types/automation"

/**
 * Regression for the CONTRATO column stuck on "—" (20260806).
 *
 * `SLUG_TO_KEY` only mapped `tufirma → contract`. A reservation signed with the
 * native provider (`hitguest_signature`) matched no slug, and — unlike check-in,
 * which has CHECKIN_NAME_RE as a fallback — nothing caught it by name. So the
 * light stayed "none" and the cell rendered the muted dash even though the
 * guest had signed. The wording ("Firmado", green) was already correct in
 * automation-cell-meta; the state feeding it never arrived.
 */
function row(overrides: Partial<AutomationStatusItem>): AutomationStatusItem {
    return {
        automationUuid: "a-uuid",
        automationName: "Firma Digital",
        providerSlug: "tufirma",
        status: "completed",
        lastError: null,
        lastRunAt: null,
        usageRecordId: null,
        contractPdfPath: null,
        wasSuccessful: true,
        lastSuccessAt: null,
        requiresCheckin: null,
        redispatchRequiresCheckin: null,
        canManualDispatch: true,
        reservationCheckinCompleted: false,
        mainGuestCheckinCompleted: false,
        canDispatch: false,
        canRedispatch: false,
        ...overrides,
    }
}

describe("buildTrafficLight — contract light", () => {
    it("lights up for tufirma", () => {
        const light = buildTrafficLight([row({ providerSlug: "tufirma" })], false)

        expect(light.contract).toBe("success")
    })

    it("lights up for the native signature provider (the bug)", () => {
        const light = buildTrafficLight([row({ providerSlug: "hitguest_signature" })], false)

        expect(light.contract).toBe("success")
    })

    it("normalizes dashes in the slug", () => {
        const light = buildTrafficLight([row({ providerSlug: "hitguest-signature" })], false)

        expect(light.contract).toBe("success")
    })

    it("falls back to the automation name for an unknown signature provider", () => {
        const light = buildTrafficLight(
            [row({ providerSlug: "some_future_signer", automationName: "Firma Digital" })],
            false,
        )

        expect(light.contract).toBe("success")
    })

    it("reports a pending signature as pending, not as success", () => {
        const light = buildTrafficLight(
            [row({ providerSlug: "hitguest_signature", status: "pending" })],
            false,
        )

        expect(light.contract).toBe("pending")
    })

    it("leaves contract as none when no signature automation exists", () => {
        const light = buildTrafficLight(
            [row({ providerSlug: "tra_colombia", automationName: "TRA Colombia" })],
            false,
        )

        expect(light.contract).toBe("none")
        expect(light.tra).toBe("success")
    })

    it("does not let the contract fallback steal an identity-verification row", () => {
        // CHECKIN_NAME_RE is evaluated first on purpose.
        const light = buildTrafficLight(
            [row({ providerSlug: "didit", automationName: "Verificación de Identidad (Principal)" })],
            false,
        )

        expect(light.checkin).toBe("success")
        expect(light.contract).toBe("none")
    })
})
