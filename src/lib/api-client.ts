import { ApiError, ApiErrorResponse } from "@/types/api"
import { useAuthStore } from "@/lib/store/auth-store"
import { useLanguageStore } from "@/store/useLanguageStore"

/**
 * Handle a session-expiry 401: clear the session and bounce to /login, but only
 * if the user actually had a session (a 401 on a public/app-token call must not
 * log out). Exported so non-apiClient callers (e.g. multipart uploads that use a
 * raw fetch) can reuse the exact same behavior.
 */
export function handleSessionExpired() {
    const state = useAuthStore.getState()
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
    /**
     * When true, leave Authorization empty so the same-origin BFF authenticates
     * the allowlisted pre-login/app-level endpoint with its server-only token.
     *
     * For everything else (properties, reservations, listings, documents…) leave
     * this false: those requests must be scoped to the logged-in account via the
     * SESSION token only. Falling back to the shared app token there would make
     * every user see the app-token account's data — the cross-account data leak
     * this flag exists to prevent.
     */
    appAuth?: boolean
}

export async function request<T>(
    url: string,
    options?: RequestOptions
): Promise<T> {
    const state = useAuthStore.getState()
    const sessionToken = state.user?.token
    
    // Handle headers safely
    const customHeaders = options?.headers 
        ? (Object.fromEntries(new Headers(options.headers as any).entries())) 
        : {}

    // Reflect the PM's selected UI language so the backend returns error
    // messages in the same locale (es | en | pt). Falls back to "es".
    const locale = useLanguageStore.getState().language || "es"

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Language": locale,
        "X-Locale": locale,
        "X-App-Locale": locale,
        ...customHeaders,
    }

    // Attach the auth token unless this is a fully public (skipAuth) endpoint.
    //
    // Token selection is EXPLICIT — no silent "session || app" fallback:
    //   • appAuth  → no browser credential; the same-origin BFF supplies the
    //                server-only app token for allowlisted public endpoints
    //   • default  → the user's SESSION token, and ONLY that. If it's missing we
    //     send no Authorization header so the backend answers 401 (→ login),
    //     rather than leaking another account's data via the shared app token.
    if (!options?.skipAuth) {
        const finalToken = options?.appAuth ? null : sessionToken
        if (finalToken) {
            headers["Authorization"] = `Bearer ${finalToken}`
        } else if (!options?.appAuth) {
            console.warn(
                "[apiClient] No session token for a user-scoped request — sending unauthenticated:",
                url,
            )
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
            handleSessionExpired()
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
