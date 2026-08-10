import { NextRequest, NextResponse } from "next/server"
import { nominatimSearch } from "@/lib/geocoding/nominatim"

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
    // Google queda opt-in mientras su API está deshabilitada en los ambientes.
    // Tener una clave antigua/inválida ya no basta para desviar el flujo nativo.
    const googleEnabled = process.env.GEOCODING_PROVIDER === "google" && Boolean(key)
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
    const session = req.nextUrl.searchParams.get("session") ?? undefined

    if (q.length < 3) return NextResponse.json({ suggestions: [] })

    // OpenStreetMap/Nominatim es el proveedor nativo y el predeterminado. Google
    // solo se usa cuando se habilita explícitamente con GEOCODING_PROVIDER=google.
    if (!googleEnabled || !key) return nativeAutocomplete(q)

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
            return nativeAutocomplete(q)
        }
        const suggestions = (data.suggestions ?? []).flatMap(({ placePrediction }) => {
            const placeId = placePrediction?.placeId
            const description = placePrediction?.text?.text
            return placeId && description ? [{ placeId, description }] : []
        })
        return NextResponse.json({ suggestions })
    } catch (error: unknown) {
        console.error("[geocode/autocomplete] Error:", error instanceof Error ? error.message : error)
        return nativeAutocomplete(q)
    }
}
