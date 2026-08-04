import "server-only"

/**
 * Server-side API helper for Next.js API Routes (BFF layer).
 *
 * This module provides a `serverFetch` function that calls the Kunas API
 * from the server side, avoiding CORS preflight and keeping the auth token
 * out of the client bundle.
 *
 * Usage (inside `src/app/api/.../route.ts`):
 *   import { serverFetch } from "@/lib/server-api"
 *   const data = await serverFetch<MyType>("/properties")
 */

const API_BASE = (
    process.env.NEXT_PUBLIC_API_URL_GUEST ||
    "https://guest.hit.tools/api/v1"
).replace(/\/$/, "")

/**
 * Returns the best available token for server-side calls.
 * Prefers the non-public env var (if set), falls back to the public one.
 */
function getServerToken(): string {
    return (
        process.env.APP_API_TOKEN ||
        process.env.NEXT_PUBLIC_APP_API_TOKEN ||
        ""
    )
}

export interface ServerFetchOptions {
    method?: string
    body?: any
    /** Extra headers to merge */
    headers?: Record<string, string>
    /** If provided, this bearer token overrides the default server token */
    token?: string
    /**
     * When true, this call MUST use a per-user token (`opts.token`). If none is
     * provided it throws instead of silently falling back to the shared app
     * token. Use for account-scoped data (properties, listings, reservations…)
     * so one account can never see another's data via the app token.
     */
    requireUserToken?: boolean
}

/**
 * Fetch a Kunas API endpoint from the server side.
 *
 * @param path  Relative path starting with "/" (e.g. "/properties")
 * @param opts  Optional method, body, headers, token override
 * @returns     Parsed JSON body (unwraps `.data` if present)
 */
export async function serverFetch<T = any>(
    path: string,
    opts?: ServerFetchOptions,
): Promise<T> {
    const url = `${API_BASE}${path}`

    // Account-scoped endpoints must use the caller's own token. Never fall back
    // to the shared app token here — that is exactly how every user ended up
    // seeing the app-token account's properties.
    if (opts?.requireUserToken && !opts?.token) {
        throw new Error("UNAUTHENTICATED: user token required for this request")
    }
    const token = opts?.token || getServerToken()

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "es",
        "X-Locale": "es",
        "X-App-Locale": "es",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts?.headers || {}),
    }

    const res = await fetch(url, {
        method: opts?.method || "GET",
        headers,
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
        // Disable Next.js fetch cache so we always get fresh data
        cache: "no-store",
    })

    let data: any
    try {
        data = await res.json()
    } catch {
        data = { message: "Could not parse response" }
    }

    if (!res.ok) {
        console.error(`[serverFetch] ${res.status} ${url}`, data)
        throw new Error(data?.message || `Server error ${res.status}`)
    }

    // Unwrap { data: T } envelope if present
    return data?.data !== undefined ? data.data : data
}
