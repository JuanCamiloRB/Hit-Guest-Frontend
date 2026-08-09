/**
 * Which option slugs have NO counterpart in the country's `/providers` list.
 *
 * DIAGNOSTIC ONLY — nothing in the UI is gated on this result.
 *
 * This started as an inline `.filter()` in PropertiesAutomation that REMOVED
 * unmatched options. That silently collapsed the 2-option identity automations
 * (Verificación avanzada / esencial) to 1, and AutomationCard renders a plain
 * text label instead of the selector when there is only one option — so the PM
 * saw a frozen "Proveedor: Verificación avanzada" with no dropdown at all.
 *
 * It is not used to block selection because the comparison is not trustworthy:
 * our option values are hardcoded slugs ("didit", "textract") that have never
 * been verified against what the backend seeds, so a NON-match may just mean a
 * renamed slug. Blocking on it hides a working provider. A rejected
 * `configure()` call already surfaces the real reason with a toast and rolls
 * the selection back; this function only makes the mismatch visible in the
 * console so the slug question can be settled with real data.
 */

import { canonicalSlug } from "../services/automation-service"

export interface ProviderAvailability {
    /** Option values that exist but cannot be selected. */
    unavailableValues: string[]
    /**
     * False when the country provider list came back empty — then "unavailable"
     * means the fetch failed or the country has no seeds at all, which is a
     * different message than "not enabled for this country".
     */
    providersLoaded: boolean
}

/**
 * The currently configured provider is ALWAYS available, even when it is absent
 * from the country list (e.g. it was deactivated after being configured) —
 * otherwise the card would mark the very option it is using as unpickable.
 */
export function resolveProviderAvailability(
    optionValues: string[],
    countryProviderSlugs: string[],
    currentSlug: string | null | undefined,
): ProviderAvailability {
    const available = new Set(countryProviderSlugs.map(canonicalSlug))
    const current = canonicalSlug(currentSlug)

    return {
        providersLoaded: countryProviderSlugs.length > 0,
        unavailableValues: optionValues.filter((value) => {
            const slug = canonicalSlug(value)
            return !available.has(slug) && slug !== current
        }),
    }
}
