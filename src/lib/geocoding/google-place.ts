import type { GeocodePlaceDetails } from "./address"

export interface GoogleAddressComponent {
    types?: string[]
    longText?: string
    shortText?: string
}

export interface GooglePlaceResponse {
    formattedAddress?: string
    location?: { latitude?: number; longitude?: number }
    addressComponents?: GoogleAddressComponent[]
}

function pickComponent(
    components: GoogleAddressComponent[],
    types: string[],
    field: "longText" | "shortText" = "longText",
): string {
    const match = components.find((component) =>
        (component.types ?? []).some((type) => types.includes(type)),
    )
    return match?.[field]?.trim() ?? ""
}

/** Maps Google Places (New) into the provider-independent address contract. */
export function mapGooglePlaceDetails(data: GooglePlaceResponse): GeocodePlaceDetails {
    const components = data.addressComponents ?? []
    const streetNumber = pickComponent(components, ["street_number"])
    const streetName = pickComponent(components, ["route"])

    return {
        lat: data.location?.latitude ?? null,
        lng: data.location?.longitude ?? null,
        formattedAddress: data.formattedAddress?.trim() ?? "",
        addressLine1: [streetNumber, streetName].filter(Boolean).join(" "),
        // `premise` is often a building/hotel name, not a unit. Putting it in
        // line 2 would silently turn “Pullman Hotel” into an apartment number.
        addressLine2: pickComponent(components, ["subpremise"]),
        streetNumber,
        streetName,
        city: pickComponent(components, [
            "locality",
            "postal_town",
            "administrative_area_level_2",
        ]),
        suburb: pickComponent(components, [
            "sublocality_level_1",
            "sublocality",
            "neighborhood",
        ]),
        state: pickComponent(components, ["administrative_area_level_1"]),
        postalCode: pickComponent(components, ["postal_code"]),
        countryCode: pickComponent(components, ["country"], "shortText").toUpperCase(),
    }
}
