import { describe, it, expect } from "vitest"
import { resolveProviderAvailability } from "./provider-availability"

/**
 * Origin: the "el selector se queda estático" report (20260806).
 *
 * The identity automations offer two options ("Verificación avanzada" = didit,
 * "Verificación esencial" = textract). The old code FILTERED OUT any option the
 * country's /providers list didn't cover; with only `didit` matching that left
 * one option, and AutomationCard renders a text label instead of a Select when
 * `providerOptions.length === 1`. Result: no dropdown, no explanation.
 *
 * The function survives as a console diagnostic (see its jsdoc) — the UI no
 * longer gates on it. These tests pin what it reports, not what the user can
 * pick.
 */
const IDENTITY_OPTIONS = ["didit", "textract"]

describe("resolveProviderAvailability", () => {
    it("marks the option the country lacks instead of dropping it", () => {
        const result = resolveProviderAvailability(IDENTITY_OPTIONS, ["didit"], "didit")

        expect(result.unavailableValues).toEqual(["textract"])
        expect(result.providersLoaded).toBe(true)
    })

    it("marks nothing when the country covers every option", () => {
        const result = resolveProviderAvailability(IDENTITY_OPTIONS, ["didit", "textract"], "didit")

        expect(result.unavailableValues).toEqual([])
    })

    it("keeps the configured provider available even if it left the country list", () => {
        // A provider deactivated AFTER being configured must not be reported as
        // unpickable — it is the one currently in use.
        const result = resolveProviderAvailability(IDENTITY_OPTIONS, ["didit"], "textract")

        expect(result.unavailableValues).toEqual([])
    })

    it("normalizes slug punctuation on both sides", () => {
        // canonicalSlug lowercases and maps '-' to '_', so these must match.
        const result = resolveProviderAvailability(["sire-colombia"], ["SIRE_COLOMBIA"], null)

        expect(result.unavailableValues).toEqual([])
    })

    it("flags providersLoaded=false when the country list came back empty", () => {
        // Distinguishes a failed/empty /providers fetch from a real country rule —
        // they need different messages in the UI.
        const result = resolveProviderAvailability(IDENTITY_OPTIONS, [], "didit")

        expect(result.providersLoaded).toBe(false)
        expect(result.unavailableValues).toEqual(["textract"])
    })
})
