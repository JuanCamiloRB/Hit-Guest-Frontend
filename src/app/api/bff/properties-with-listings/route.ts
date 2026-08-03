import { NextRequest, NextResponse } from "next/server"
import { serverFetch } from "@/lib/server-api"

/**
 * GET /api/bff/properties-with-listings
 *
 * Aggregated BFF endpoint.  Fetches all properties, then fetches listings
 * for each property **in parallel** on the server side.
 *
 * Result: the client makes a SINGLE request and gets everything it needs.
 *
 * Response shape:
 *   { properties: PropertyApiResponse[], listings: ListingApiResponse[] }
 */
export async function GET(req: NextRequest) {
    try {
        // Require the user's session token — this data is account-scoped and must
        // never fall back to the shared app token (cross-account data leak).
        const authHeader = req.headers.get("authorization")
        const token = authHeader?.replace("Bearer ", "") || undefined
        if (!token) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 })
        }

        // 1. Fetch all properties
        const rawProperties = await serverFetch<any>("/properties", { token, requireUserToken: true })
        const properties: any[] = Array.isArray(rawProperties)
            ? rawProperties
            : Array.isArray(rawProperties?.data)
              ? rawProperties.data
              : []

        // 2. Fetch listings for each property IN PARALLEL (server-side, no CORS)
        const listingsResults = await Promise.allSettled(
            properties.map((p) =>
                // Nested endpoint scoped to the property. The flat `/listings?property_uuid=`
                // used an INVALID (snake_case) filter that the backend silently discards,
                // returning ALL of the account's listings for every property.
                serverFetch<any>(`/properties/${p.uuid}/listings`, { token, requireUserToken: true })
                    .then((res) => {
                        const list = Array.isArray(res)
                            ? res
                            : Array.isArray(res?.data)
                              ? res.data
                              : []
                        // Tag each listing with its property UUID for easy mapping
                        return list.map((l: any) => ({
                            ...l,
                            _propertyUuid: p.uuid,
                        }))
                    })
                    .catch((err) => {
                        console.warn(
                            `[BFF] Failed to fetch listings for property ${p.uuid}:`,
                            err.message,
                        )
                        return [] // Don't let one failure break everything
                    }),
            ),
        )

        const listings = listingsResults.flatMap((r) =>
            r.status === "fulfilled" ? r.value : [],
        )

        return NextResponse.json({ properties, listings })
    } catch (error: any) {
        console.error("[BFF /properties-with-listings] Error:", error.message)
        return NextResponse.json(
            { error: error.message || "Failed to fetch aggregated data" },
            { status: 502 },
        )
    }
}
