/**
 * Single source of truth for guest-communication locales (check-in link email, etc.).
 * Used by the property form (default selector), the reservation operations panel
 * (resend override), and anywhere a locale → label mapping is needed.
 */

export type CommunicationLocale = "es" | "en" | "pt"

/** Ordered list of supported locales — drives selectors so options never drift. */
export const COMMUNICATION_LOCALES: readonly CommunicationLocale[] = ["es", "en", "pt"] as const

/** Human label per locale (shown in selectors / menus). */
export const LOCALE_LABELS: Record<CommunicationLocale, string> = {
    es: "Español",
    en: "English",
    pt: "Português",
}

/** Default locale when none is configured. */
export const DEFAULT_COMMUNICATION_LOCALE: CommunicationLocale = "es"

/**
 * Normalizes an arbitrary backend value (e.g. "ES", "es-CO", null) to a known
 * locale, or `undefined` if it isn't one we support. Keeps UI lookups safe.
 */
export function normalizeLocale(value?: string | null): CommunicationLocale | undefined {
    if (!value) return undefined
    const v = value.toLowerCase().slice(0, 2)
    return (COMMUNICATION_LOCALES as readonly string[]).includes(v)
        ? (v as CommunicationLocale)
        : undefined
}
