import { NextRequest, NextResponse } from "next/server"
import { serverFetch } from "@/lib/server-api"

/**
 * GET /api/bff/properties
 *
 * Server-side proxy to Kunas GET /properties.
 * Eliminates CORS preflight for the client.
 */
export async function GET(req: NextRequest) {
    try {
        // Forward the user's session token if present
        const authHeader = req.headers.get("authorization")
        const token = authHeader?.replace("Bearer ", "") || undefined

        const properties = await serverFetch<any[]>("/properties", { token })

        // Normalize: API may return paginated { data, meta } or plain array
        const list = Array.isArray(properties)
            ? properties
            : Array.isArray((properties as any)?.data)
              ? (properties as any).data
              : []

        return NextResponse.json({ data: list })
    } catch (error: any) {
        console.error("[BFF /properties] Error:", error.message)
        return NextResponse.json(
            { error: error.message || "Failed to fetch properties" },
            { status: 502 },
        )
    }
}
