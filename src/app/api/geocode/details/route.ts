import { NextRequest, NextResponse } from "next/server"
import { isNominatimPlaceId, nominatimLookup } from "@/lib/geocoding/nominatim"
import {
    mapGooglePlaceDetails,
    type GooglePlaceResponse,
} from "@/lib/geocoding/google-place"
import { resolveAutocompleteProvider } from "@/lib/geocoding/provider"

interface GooglePlaceDetailsResponse extends GooglePlaceResponse {
    error?: { message?: string }
}

/**
 * GET /api/geocode/details?placeId=<id>&session=<token>
 *
 * Server-side proxy to Google Place Details (New). Passing the same `session`
 * token used for the autocomplete keystrokes closes the billing session.
 *
 * Returns a provider-independent, structured address including unit, street
 * number, street name, locality, state, postal code and country code.
 */

export async function GET(req: NextRequest) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    const provider = resolveAutocompleteProvider({
        provider: process.env.GEOCODING_PROVIDER,
        googleApiKey: key,
        nominatimBaseUrl: process.env.NOMINATIM_BASE_URL,
    })
    const placeId = req.nextUrl.searchParams.get("placeId")?.trim()
    const session = req.nextUrl.searchParams.get("session") ?? undefined

    if (!placeId) return NextResponse.json({ error: "placeId requerido" }, { status: 400 })

    // Un id N/W/R pertenece siempre a OpenStreetMap, incluso si Google se activa
    // más adelante entre la búsqueda y la selección del usuario. Así nunca se
    // envía un identificador nativo al endpoint incompatible de Google.
    if (isNominatimPlaceId(placeId)) {
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

    if (provider !== "google" || !key) {
        return NextResponse.json(
            { error: "Proveedor global de geocodificación no configurado" },
            { status: 503 },
        )
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

        return NextResponse.json(mapGooglePlaceDetails(data))
    } catch (error: unknown) {
        console.error("[geocode/details] Error:", error instanceof Error ? error.message : error)
        return NextResponse.json({ error: "Error de geocodificación" }, { status: 502 })
    }
}
