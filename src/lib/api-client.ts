import { ApiResponse, ApiError, ApiErrorResponse } from "@/types/api"

export async function request<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Accept-Language": "es",
            "X-Locale": "es",
            "X-App-Locale": "es",
            ...options?.headers,
        },
    })

    const data = await response.json()

    if (!response.ok) {
        throw new ApiError(response.status, data as ApiErrorResponse)
    }

    // Support both { data: T } and direct T responses
    return (data as any).data !== undefined ? (data as any).data : data
}

export const apiClient = {
    get: <T>(url: string, options?: RequestInit) => request<T>(url, { ...options, method: "GET" }),
    post: <T>(url: string, body: any, options?: RequestInit) =>
        request<T>(url, {
            ...options,
            method: "POST",
            body: JSON.stringify(body),
        }),
    put: <T>(url: string, body: any, options?: RequestInit) =>
        request<T>(url, {
            ...options,
            method: "PUT",
            body: JSON.stringify(body),
        }),
    delete: <T>(url: string, options?: RequestInit) =>
        request<T>(url, { ...options, method: "DELETE" }),
}
