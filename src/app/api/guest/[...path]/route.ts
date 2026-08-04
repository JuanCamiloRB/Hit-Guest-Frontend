import "server-only"

import { NextRequest } from "next/server"

const BACKEND_BASE = (
    process.env.API_URL_GUEST
    || process.env.NEXT_PUBLIC_API_URL_GUEST
    || "https://guest.hit.tools/api/v1"
).trim().replace(/\/$/, "")

// Temporary fallback keeps existing deployments working while the secret is
// renamed in Vercel. Because this module is server-only, the fallback value is
// never included in browser JavaScript.
const APP_TOKEN = process.env.APP_API_TOKEN || process.env.NEXT_PUBLIC_APP_API_TOKEN || ""

const APP_AUTH_PATHS = [
    /^auth\/(login|verify-otp|resend-otp)\/?$/,
    /^account\/register\/?$/,
    /^catalogs(?:\/|$)/,
    /^countries(?:\/|$)/,
    /^checkin(?:\/|$)/,
]

interface RouteContext {
    params: Promise<{ path: string[] }>
}

function isAppAuthAllowed(path: string): boolean {
    return APP_AUTH_PATHS.some(pattern => pattern.test(path))
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
    const { path: segments } = await context.params
    if (!segments?.length || segments.some(segment => !segment || segment === "." || segment === "..")) {
        return Response.json({ message: "Invalid backend path" }, { status: 400 })
    }

    const path = segments.join("/")
    const incomingAuthorization = request.headers.get("authorization")
    const useAppToken = !incomingAuthorization && isAppAuthAllowed(path)

    if (!incomingAuthorization && !useAppToken) {
        return Response.json({ message: "Authentication required" }, { status: 401 })
    }
    if (useAppToken && !APP_TOKEN) {
        console.error("[api/guest] Missing server-side APP_API_TOKEN")
        return Response.json({ message: "Server authentication is not configured" }, { status: 500 })
    }

    const target = new URL(`${BACKEND_BASE}/${path}`)
    target.search = request.nextUrl.search

    const headers = new Headers()
    for (const name of [
        "accept",
        "accept-language",
        "content-type",
        "x-locale",
        "x-app-locale",
        "x-checkin-verification-token",
    ]) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    headers.set("authorization", incomingAuthorization || `Bearer ${APP_TOKEN}`)

    const hasBody = request.method !== "GET" && request.method !== "HEAD"
    const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        cache: "no-store",
        redirect: "manual",
    })

    const responseHeaders = new Headers()
    for (const name of ["content-type", "content-disposition", "cache-control", "location", "retry-after"]) {
        const value = upstream.headers.get(name)
        if (value) responseHeaders.set(name, value)
    }

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
