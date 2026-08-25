export type AutocompleteProvider = "google" | "nominatim" | null

interface GeocodingConfiguration {
    provider?: string
    googleApiKey?: string
    nominatimBaseUrl?: string
}

/** Resolves one worldwide autocomplete provider without silent public fallbacks. */
export function resolveAutocompleteProvider({
    provider,
    googleApiKey,
    nominatimBaseUrl,
}: GeocodingConfiguration): AutocompleteProvider {
    const selected = provider?.trim().toLowerCase()
    if (selected === "nominatim") return nominatimBaseUrl?.trim() ? "nominatim" : null
    return googleApiKey?.trim() ? "google" : null
}

