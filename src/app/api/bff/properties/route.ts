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
        // Require the user's session token — this list is account-scoped.
        // Without it we must NOT fall back to the shared app token (that leaked
        // one account's properties to every user).
        const authHeader = req.headers.get("authorization")
        const token = authHeader?.replace("Bearer ", "") || undefined
        if (!token) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 })
        }

        const properties = await serverFetch<any[]>("/properties", { token, requireUserToken: true })

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
