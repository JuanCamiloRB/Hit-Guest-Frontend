import { ApiError, ApiErrorResponse } from "@/types/api"
import { useAuthStore } from "@/lib/store/auth-store"
import { CONFIG } from "@/lib/config"

function handleUnauthorized() {
    const state = useAuthStore.getState()
    // Only treat this as a session expiry (and redirect) if the user actually
    // had a session token. A 401 on a public/app-token call must NOT log out
    // or redirect — that caused the unexpected-logout issue previously.
    const hadSession = !!state.user?.token
    state.clearSession()

    if (hadSession && typeof window !== "undefined") {
        // Avoid redirect loops if we're already on the login page.
        if (!window.location.pathname.startsWith("/login")) {
            window.location.href = "/login"
        }
    }
}

interface RequestOptions extends RequestInit {
    skipAuth?: boolean
    /** When true, a 401 response will NOT clear the session / redirect to login. */
    suppressUnauthorizedRedirect?: boolean
}

export async function request<T>(
    url: string,
    options?: RequestOptions
): Promise<T> {
    const state = useAuthStore.getState()
    const sessionToken = state.user?.token
    const appToken = CONFIG.APP_API_TOKEN
    
    // Handle headers safely
    const customHeaders = options?.headers 
        ? (Object.fromEntries(new Headers(options.headers as any).entries())) 
        : {}

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Language": "es",
        "X-Locale": "es",
        "X-App-Locale": "es",
        ...customHeaders,
    }

    // Only attach auth token if not a public endpoint
    if (!options?.skipAuth) {
        const finalToken = sessionToken || appToken
        console.log("🔍 [apiClient] url:", url)
        console.log("🔍 [apiClient] sessionToken:", sessionToken ? "exists" : "null")
        console.log("🔍 [apiClient] appToken:", appToken ? "exists" : "null")
        console.log("🔍 [apiClient] finalToken:", finalToken ? finalToken.substring(0, 20) + "..." : "null")
        if (finalToken) {
            headers["Authorization"] = `Bearer ${finalToken}`
        }
    }

    const response = await fetch(url, {
        ...options,
        headers,
    })

    let data: any
    try {
        data = await response.json()
    } catch (e) {
        data = { message: "Could not parse response" }
    }

    if (!response.ok) {
        if (response.status === 401 && !options?.suppressUnauthorizedRedirect) {
            handleUnauthorized()
        }
        throw new ApiError(response.status, data as ApiErrorResponse)
    }

    // Support both { data: T } and direct T responses
    return data?.data !== undefined ? data.data : data
}

export const apiClient = {
    get: <T>(url: string, options?: RequestOptions) => 
        request<T>(url, { ...options, method: "GET" }),
    
    post: <T>(url: string, body?: any, options?: RequestOptions) =>
        request<T>(url, {
            ...options,
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
        }),
    
    put: <T>(url: string, body?: any, options?: RequestOptions) =>
        request<T>(url, {
            ...options,
            method: "PUT",
            body: body ? JSON.stringify(body) : undefined,
        }),

    patch: <T>(url: string, body?: any, options?: RequestOptions) =>
        request<T>(url, {
            ...options,
            method: "PATCH",
            body: body ? JSON.stringify(body) : undefined,
        }),
    
    delete: <T>(url: string, options?: RequestOptions) =>
        request<T>(url, { ...options, method: "DELETE" }),
}

export const publicClient = {
    get: <T>(url: string) =>
        request<T>(url, { method: "GET", skipAuth: true }),

    post: <T>(url: string, body?: any) =>
        request<T>(url, {
            method: "POST",
            skipAuth: true,
            body: body ? JSON.stringify(body) : undefined,
        }),
}
