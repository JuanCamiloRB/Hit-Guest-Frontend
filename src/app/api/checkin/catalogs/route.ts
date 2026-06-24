import { NextRequest, NextResponse } from "next/server"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL_GUEST || "https://www.kunas.co/api/v1")
    .trim()
    .replace(/\/auth\/?$/, "")
const TOKEN = process.env.APP_API_TOKEN || process.env.NEXT_PUBLIC_APP_API_TOKEN || ""

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") || ""
    if (!category) {
        return NextResponse.json({ error: "Missing category" }, { status: 400 })
    }

    if (!TOKEN) {
        console.error("[api/checkin/catalogs] No API token configured (APP_API_TOKEN / NEXT_PUBLIC_APP_API_TOKEN)")
        return NextResponse.json(
            { message: "Server misconfiguration: missing API token" },
            { status: 500 }
        )
    }

    const url = `${API_BASE}/catalogs?status[eq]=ACT&catalogCategoryName[eq]=${category}`

    try {
        const res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TOKEN}`,
            },
            cache: "no-store",
        })

        const json = await res.json()

        if (!res.ok) {
            console.error(`[api/checkin/catalogs] Backend returned ${res.status} for "${category}":`, JSON.stringify(json).slice(0, 300))
        }

        return NextResponse.json(json, { status: res.status })
    } catch (error) {
        console.error(`[api/checkin/catalogs] Fetch failed for "${category}":`, error)
        return NextResponse.json(
            { message: "Failed to reach backend" },
            { status: 502 }
        )
    }
}
