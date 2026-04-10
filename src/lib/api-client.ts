import { ApiError, ApiErrorResponse } from "@/types/api"
import { useAuthStore } from "@/lib/store/auth-store"
import { CONFIG } from "@/lib/config"

export async function request<T>(
    url: string,
    options?: RequestInit
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

    // Priority: sessionToken > appToken
    const finalToken = sessionToken || appToken
    if (finalToken) {
        headers["Authorization"] = `Bearer ${finalToken}`
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
        throw new ApiError(response.status, data as ApiErrorResponse)
    }

    // Support both { data: T } and direct T responses
    return data?.data !== undefined ? data.data : data
}

export const apiClient = {
    get: <T>(url: string, options?: RequestInit) => 
        request<T>(url, { ...options, method: "GET" }),
    
    post: <T>(url: string, body?: any, options?: RequestInit) =>
        request<T>(url, {
            ...options,
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
        }),
    
    put: <T>(url: string, body?: any, options?: RequestInit) =>
        request<T>(url, {
            ...options,
            method: "PUT",
            body: body ? JSON.stringify(body) : undefined,
        }),
    
    delete: <T>(url: string, options?: RequestInit) =>
        request<T>(url, { ...options, method: "DELETE" }),
}
