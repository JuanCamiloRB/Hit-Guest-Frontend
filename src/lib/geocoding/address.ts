/**
 * Canonical address shape shared by both geocoding providers and the form.
 *
 * `addressLine1` and `addressLine2` mirror the property API contract. The
 * remaining components are kept explicit so provider-specific parsing never
 * leaks into the React form.
 */
export interface GeocodePlaceDetails {
    lat: number | null
    lng: number | null
    formattedAddress: string
    addressLine1: string
    addressLine2: string
    streetNumber: string
    streetName: string
    city: string
    suburb: string
    state: string
    postalCode: string
    /** ISO 3166-1 alpha-2 code, for example "AU" or "CO". */
    countryCode: string
}

export interface TypedAddressParts {
    unit: string
    streetNumber: string
    streetName: string
}

function clean(value: string | null | undefined): string {
    return (value ?? "").trim().replace(/\s+/g, " ")
}

function splitStreet(value: string): Pick<TypedAddressParts, "streetNumber" | "streetName"> {
    const match = clean(value).match(/^(\d+[\p{L}]?(?:-\d+[\p{L}]?)?)\s+(.+)$/u)
    if (!match) return { streetNumber: "", streetName: clean(value) }
    return { streetNumber: match[1], streetName: clean(match[2]) }
}

/**
 * Extracts premise data that address providers commonly discard from free-text
 * searches. It deliberately recognises only unambiguous leading formats:
 *
 * - `9/36 Hampton Parade`
 * - `Unit 9, 36 Hampton Parade`
 * - `36 Hampton Parade`
 *
 * Country-specific formats such as `Carrera 7 # 72-41` are left untouched.
 */
export function parseTypedAddress(value: string): TypedAddressParts {
    const input = clean(value)
    const slash = input.match(/^([\p{L}\d]+(?:-[\p{L}\d]+)?)\s*\/\s*(\d+[\p{L}]?(?:-\d+[\p{L}]?)?)\s+(.+)$/u)
    if (slash) {
        return { unit: slash[1], streetNumber: slash[2], streetName: clean(slash[3]) }
    }

    const labelledUnit = input.match(
        /^(?:unit|apartment|apt|suite|flat|unidad|apartamento|apto|depto|dpto)\.?\s+([\p{L}\d]+(?:-[\p{L}\d]+)?)\s*,?\s+(.+)$/iu,
    )
    if (labelledUnit) {
        return { unit: labelledUnit[1], ...splitStreet(labelledUnit[2]) }
    }

    return { unit: "", ...splitStreet(input) }
}

/**
 * Query sent to the geocoder. Unit identifiers are valuable to HitGuest but
 * frequently make global providers reject or downgrade an otherwise valid
 * street search. We remove only a positively identified unit prefix and keep
 * the original value client-side for the final merge.
 */
export function toGeocoderQuery(value: string): string {
    const input = clean(value)
    const typed = parseTypedAddress(input)
    if (!typed.unit || !typed.streetNumber || !typed.streetName) return input
    return `${typed.streetNumber} ${typed.streetName}`
}

function startsWithToken(value: string, token: string): boolean {
    if (!token) return false
    return clean(value).toLocaleLowerCase().startsWith(clean(token).toLocaleLowerCase())
}

/** Makes the full premise visible even when a provider suggests only a road. */
export function formatSuggestion(description: string, typedValue: string): string {
    const suggestion = clean(description)
    const typed = parseTypedAddress(typedValue)
    if (!typed.streetNumber) return suggestion

    const premise = typed.unit
        ? `${typed.unit}/${typed.streetNumber}`
        : typed.streetNumber

    if (startsWithToken(suggestion, premise)) return suggestion
    if (typed.unit && startsWithToken(suggestion, typed.streetNumber)) {
        return `${typed.unit}/${suggestion}`
    }
    if (typed.streetName && startsWithToken(suggestion, typed.streetName)) {
        return `${premise} ${suggestion}`
    }
    return suggestion
}

/**
 * Reconciles structured provider data with the exact premise typed by the PM.
 * Provider data wins when it is present; typed unit/number only fills missing
 * components. This prevents both data loss and duplicated street numbers.
 */
export function mergeTypedAddress(
    details: GeocodePlaceDetails,
    typedValue: string,
): GeocodePlaceDetails {
    const typed = parseTypedAddress(typedValue)
    const streetNumber = clean(details.streetNumber) || typed.streetNumber
    const streetName = clean(details.streetName) || typed.streetName
    const addressLine2 = clean(details.addressLine2) || typed.unit
    const structuredLine1 = clean([streetNumber, streetName].filter(Boolean).join(" "))

    return {
        ...details,
        streetNumber,
        streetName,
        addressLine1: structuredLine1 || clean(details.addressLine1) || clean(details.formattedAddress),
        addressLine2,
    }
}
