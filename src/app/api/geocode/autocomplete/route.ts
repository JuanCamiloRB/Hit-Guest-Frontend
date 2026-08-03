import { NextRequest, NextResponse } from "next/server"

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

    // Degrade gracefully: no key or too-short query → empty list (no error toast).
    if (!key) {
        console.warn("[geocode/autocomplete] GOOGLE_MAPS_API_KEY is not set")
        return NextResponse.json({ suggestions: [] })
    }
    if (q.length < 3) return NextResponse.json({ suggestions: [] })

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
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            console.error("[geocode/autocomplete] Google error:", res.status, data?.error?.message)
            return NextResponse.json({ suggestions: [] }, { status: 502 })
        }
        const suggestions = (data?.suggestions ?? [])
            .map((s: any) => s?.placePrediction)
            .filter(Boolean)
            .map((p: any) => ({
                placeId: p.placeId as string,
                description: (p.text?.text ?? "") as string,
            }))
        return NextResponse.json({ suggestions })
    } catch (error: any) {
        console.error("[geocode/autocomplete] Error:", error?.message)
        return NextResponse.json({ suggestions: [] }, { status: 502 })
    }
}
