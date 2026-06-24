import { NextRequest, NextResponse } from "next/server"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1")
    .trim()
    .replace(/\/auth\/?$/, "")

const APP_TOKEN = process.env.APP_API_TOKEN || process.env.NEXT_PUBLIC_APP_API_TOKEN || ""

async function fetchCountries(token: string | null): Promise<Response> {
    const headers: Record<string, string> = { "Accept": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    return fetch(`${API_BASE}/countries`, { headers, cache: "no-store" })
}

export async function GET(req: NextRequest) {
    try {
        // Priority 1: forward the browser's own Authorization header (admin session token).
        // This covers the admin dashboard where the user is already logged in.
        const browserAuth = req.headers.get("authorization")
        const browserToken = browserAuth?.startsWith("Bearer ") ? browserAuth.slice(7) : null

        if (browserToken) {
            const res = await fetchCountries(browserToken)
            if (res.ok) return NextResponse.json(await res.json())
            // If the browser token failed for some reason, fall through to app token
            console.warn(`[api/checkin/countries] Browser token returned ${res.status} — trying app token`)
        }

        // Priority 2: server-side app token
        if (APP_TOKEN) {
            const res = await fetchCountries(APP_TOKEN)
            if (res.ok) return NextResponse.json(await res.json())
            console.warn(`[api/checkin/countries] App token returned ${res.status} — retrying without token`)
        }

        // Priority 3: no token (endpoint may be public)
        const res = await fetchCountries(null)
        const json = await res.json()
        if (!res.ok) {
            console.error(`[api/checkin/countries] All attempts failed — last status ${res.status}`)
        }
        return NextResponse.json(json, { status: res.status })
    } catch (error) {
        console.error("[api/checkin/countries] Fetch failed:", error)
        return NextResponse.json({ message: "Failed to reach backend" }, { status: 502 })
    }
}
