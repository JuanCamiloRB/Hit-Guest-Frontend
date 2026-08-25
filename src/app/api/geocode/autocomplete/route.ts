import { NextRequest, NextResponse } from "next/server"
import { nominatimSearch } from "@/lib/geocoding/nominatim"
import { toGeocoderQuery } from "@/lib/geocoding/address"
import { resolveAutocompleteProvider } from "@/lib/geocoding/provider"

interface GoogleAutocompleteResponse {
    error?: { message?: string }
    suggestions?: Array<{
        placePrediction?: {
            placeId?: string
            text?: { text?: string }
        }
    }>
}

async function nativeAutocomplete(q: string) {
    try {
        const suggestions = await nominatimSearch(q)
        return NextResponse.json({ suggestions, provider: "nominatim" })
    } catch (error: unknown) {
        console.error(
            "[geocode/autocomplete] Nominatim error:",
            error instanceof Error ? error.message : error,
        )
        return NextResponse.json({ suggestions: [], unavailable: true })
    }
}

/**
 * GET /api/geocode/autocomplete?q=<text>&session=<token>
 *
 * Server-side proxy to Google Places Autocomplete (New). The API key lives ONLY
 * here (env, server-only) — never in the browser. `session` is a client-generated
 * token that groups the keystrokes + final details call into one billed session.
 *
 * Returns: { suggestions: [{ placeId, description }] }
 */
export async function GET(req: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    const provider = resolveAutocompleteProvider({
        provider: process.env.GEOCODING_PROVIDER,
        googleApiKey: key,
        nominatimBaseUrl: process.env.NOMINATIM_BASE_URL,
    })
    const rawQuery = req.nextUrl.searchParams.get("q")?.trim() ?? ""
    const q = toGeocoderQuery(rawQuery)
    const session = req.nextUrl.searchParams.get("session") ?? undefined
    const explicitSearch = req.nextUrl.searchParams.get("mode") === "search"

    if (rawQuery.length < 3) return NextResponse.json({ suggestions: [] })

    // The public OSM Nominatim instance expressly forbids client autocomplete.
    // It is available here only when the project points to its own/managed
    // instance. A missing global provider is a configuration error, not an empty
    // result set; exposing that distinction lets the UI give an actionable error.
    if (provider !== "google" || !key) {
        if (provider === "nominatim") return nativeAutocomplete(q)
        // Public Nominatim permits moderate searches initiated by an end user,
        // but expressly forbids using its public service for per-keystroke
        // autocomplete. Enter/button requests are therefore the free fallback.
        if (explicitSearch) return nativeAutocomplete(q)
        return NextResponse.json(
            {
                suggestions: [],
                unavailable: true,
                reason: "manual_search_required",
                manualSearchAvailable: true,
            },
            { status: 503 },
        )
    }

    try {
        const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": key,
            },
            body: JSON.stringify({
                input: q,
                languageCode: "es",
                ...(session ? { sessionToken: session } : {}),
            }),
            cache: "no-store",
        })
        const data = await res.json().catch(() => ({})) as GoogleAutocompleteResponse
        if (!res.ok) {
            console.error("[geocode/autocomplete] Google error:", res.status, data?.error?.message)
            return NextResponse.json(
                { suggestions: [], unavailable: true, reason: "provider_error" },
                { status: 502 },
            )
        }
        const suggestions = (data.suggestions ?? []).flatMap(({ placePrediction }) => {
            const placeId = placePrediction?.placeId
            const description = placePrediction?.text?.text
            return placeId && description ? [{ placeId, description }] : []
        })
        return NextResponse.json({ suggestions })
    } catch (error: unknown) {
        console.error("[geocode/autocomplete] Error:", error instanceof Error ? error.message : error)
        return NextResponse.json(
            { suggestions: [], unavailable: true, reason: "provider_error" },
            { status: 502 },
        )
    }
}
