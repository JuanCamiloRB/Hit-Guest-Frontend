import { NextRequest, NextResponse } from "next/server"
import { serverFetch } from "@/lib/server-api"

/**
 * GET /api/bff/properties/[uuid]/listings
 *
 * Server-side proxy to GET /properties/{uuid}/listings.
 * One call per property, without CORS preflight.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ uuid: string }> },
) {
    try {
        const { uuid } = await params
        // Require the user's session token — account-scoped, no app-token fallback.
        const authHeader = req.headers.get("authorization")
        const token = authHeader?.replace("Bearer ", "") || undefined
        if (!token) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 })
        }

        const listings = await serverFetch<any>(
            // Nested endpoint scoped to the property. The flat `/listings?property_uuid=`
            // was an invalid snake_case filter the backend discards → returned everything.
            `/properties/${uuid}/listings`,
            { token, requireUserToken: true },
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
