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
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
    const session = req.nextUrl.searchParams.get("session") ?? undefined

    if (q.length < 3) return NextResponse.json({ suggestions: [] })

    // Sin clave de Google se busca igual, contra Nominatim (OpenStreetMap), que
    // no requiere credenciales. Antes esta rama devolvía una lista vacía y el
    // campo quedaba muerto: el usuario escribía la dirección, nunca aparecía una
    // sugerencia, y la propiedad terminaba guardada sin coordenadas. Google
    // sigue siendo el preferido cuando la clave existe.
    if (!key) {
        try {
            const suggestions = await nominatimSearch(q)
            return NextResponse.json({ suggestions, provider: "nominatim" })
        } catch (error) {
            console.error("[geocode/autocomplete] Nominatim error:", (error as Error)?.message)
            // `unavailable` distingue "el buscador no funciona" de "no hubo
            // resultados": el cliente lo usa para decirle al usuario que ubique
            // la propiedad arrastrando el pin, en vez de dejarlo escribiendo
            // contra un campo que no responde.
            return NextResponse.json({ suggestions: [], unavailable: true })
        }
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
            return NextResponse.json({ suggestions: [] }, { status: 502 })
        }
        const suggestions = (data.suggestions ?? []).flatMap(({ placePrediction }) => {
            const placeId = placePrediction?.placeId
            const description = placePrediction?.text?.text
            return placeId && description ? [{ placeId, description }] : []
        })
        return NextResponse.json({ suggestions })
    } catch (error: unknown) {
        console.error("[geocode/autocomplete] Error:", error instanceof Error ? error.message : error)
        return NextResponse.json({ suggestions: [] }, { status: 502 })
    }
}
