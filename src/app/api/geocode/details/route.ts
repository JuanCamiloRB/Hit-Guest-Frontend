import { NextRequest, NextResponse } from "next/server"

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
    components: any[],
    types: string[],
    field: "longText" | "shortText" = "longText",
): string {
    const match = components.find((c) => (c?.types ?? []).some((t: string) => types.includes(t)))
    return (match?.[field] ?? "") as string
}

export async function GET(req: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    const placeId = req.nextUrl.searchParams.get("placeId")?.trim()
    const session = req.nextUrl.searchParams.get("session") ?? undefined

    if (!key) {
        console.warn("[geocode/details] GOOGLE_MAPS_API_KEY is not set")
        return NextResponse.json({ error: "Geocoding no configurado" }, { status: 503 })
    }
    if (!placeId) return NextResponse.json({ error: "placeId requerido" }, { status: 400 })

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
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            console.error("[geocode/details] Google error:", res.status, data?.error?.message)
            return NextResponse.json({ error: "No se pudo obtener la ubicación" }, { status: 502 })
        }

        const components: any[] = data?.addressComponents ?? []
        return NextResponse.json({
            lat: data?.location?.latitude ?? null,
            lng: data?.location?.longitude ?? null,
            formattedAddress: data?.formattedAddress ?? "",
            city: pickComponent(components, ["locality", "postal_town", "administrative_area_level_2"]),
            state: pickComponent(components, ["administrative_area_level_1"]),
            // ISO2 country code, e.g. "CO" — matched against the catalog's iso2.
            countryCode: pickComponent(components, ["country"], "shortText"),
        })
    } catch (error: any) {
        console.error("[geocode/details] Error:", error?.message)
        return NextResponse.json({ error: "Error de geocodificación" }, { status: 502 })
    }
}
