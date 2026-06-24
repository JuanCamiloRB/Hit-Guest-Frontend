import { NextRequest, NextResponse } from "next/server"
import { serverFetch } from "@/lib/server-api"

/**
 * GET /api/bff/properties/[uuid]/listings
 *
 * Server-side proxy to Kunas GET /listings?property_uuid={uuid}.
 * One call per property, without CORS preflight.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ uuid: string }> },
) {
    try {
        const { uuid } = await params
        const authHeader = req.headers.get("authorization")
        const token = authHeader?.replace("Bearer ", "") || undefined

        const listings = await serverFetch<any>(
            `/listings?propertyUuid[eq]=${uuid}`,
            { token },
        )

        // Normalize response
        const list = Array.isArray(listings)
            ? listings
            : Array.isArray(listings?.data)
              ? listings.data
              : []

        return NextResponse.json({ data: list })
    } catch (error: any) {
        console.error("[BFF /properties/[uuid]/listings] Error:", error.message)
        return NextResponse.json(
            { error: error.message || "Failed to fetch listings" },
            { status: 502 },
        )
    }
}
