import { NextRequest, NextResponse } from "next/server"
import { isNominatimPlaceId, nominatimLookup } from "@/lib/geocoding/nominatim"

interface GoogleAddressComponent {
    types?: string[]
    longText?: string
    shortText?: string
}

interface GooglePlaceDetailsResponse {
    error?: { message?: string }
    formattedAddress?: string
    location?: { latitude?: number; longitude?: number }
    addressComponents?: GoogleAddressComponent[]
}

/**
 * GET /api/geocode/details?placeId=<id>&session=<token>
 *
 * Server-side proxy to Google Place Details (New). Passing the same `session`
 * token used for the autocomplete keystrokes closes the billing session.
 *
 * Returns: { lat, lng, formattedAddress, city, state, countryCode }
 */

/** Picks the value of the first address component matching any of `types`. */
function pickComponent(
    components: GoogleAddressComponent[],
    types: string[],
    field: "longText" | "shortText" = "longText",
): string {
    const match = components.find((c) => (c?.types ?? []).some((t: string) => types.includes(t)))
    return (match?.[field] ?? "") as string
}

export async function GET(req: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    const googleEnabled = process.env.GEOCODING_PROVIDER === "google" && Boolean(key)
    const placeId = req.nextUrl.searchParams.get("placeId")?.trim()
    const session = req.nextUrl.searchParams.get("session") ?? undefined

    if (!placeId) return NextResponse.json({ error: "placeId requerido" }, { status: 400 })

    // Un id N/W/R pertenece siempre a OpenStreetMap, incluso si Google se activa
    // más adelante entre la búsqueda y la selección del usuario. Así nunca se
    // envía un identificador nativo al endpoint incompatible de Google.
    if (!googleEnabled || !key || isNominatimPlaceId(placeId)) {
        try {
            const details = await nominatimLookup(placeId)
            if (!details) {
                return NextResponse.json({ error: "No se pudo obtener la ubicación" }, { status: 404 })
            }
            return NextResponse.json(details)
        } catch (error) {
            console.error("[geocode/details] Nominatim error:", (error as Error)?.message)
            return NextResponse.json({ error: "Error de geocodificación" }, { status: 502 })
        }
    }

    try {
        const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
        url.searchParams.set("languageCode", "es")
        if (session) url.searchParams.set("sessionToken", session)

        const res = await fetch(url, {
            headers: {
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
            },
            cache: "no-store",
        })
        const data = await res.json().catch(() => ({})) as GooglePlaceDetailsResponse
        if (!res.ok) {
            console.error("[geocode/details] Google error:", res.status, data?.error?.message)
            return NextResponse.json({ error: "No se pudo obtener la ubicación" }, { status: 502 })
        }

        const components = data.addressComponents ?? []
        return NextResponse.json({
            lat: data?.location?.latitude ?? null,
            lng: data?.location?.longitude ?? null,
            formattedAddress: data?.formattedAddress ?? "",
            city: pickComponent(components, ["locality", "postal_town", "administrative_area_level_2"]),
            state: pickComponent(components, ["administrative_area_level_1"]),
            // ISO2 country code, e.g. "CO" — matched against the catalog's iso2.
            countryCode: pickComponent(components, ["country"], "shortText"),
        })
    } catch (error: unknown) {
        console.error("[geocode/details] Error:", error instanceof Error ? error.message : error)
        return NextResponse.json({ error: "Error de geocodificación" }, { status: 502 })
    }
}
