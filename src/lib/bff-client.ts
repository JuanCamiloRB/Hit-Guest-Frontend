import { useAuthStore } from "@/lib/store/auth-store"

/**
 * Calls our own Next.js API routes (same-origin, no CORS preflight).
 *
 * Account-scoped data: never call without the user's session token. Prevents the
 * auth-store hydration race from firing an unauthenticated request (which an old
 * BFF build would have served with the shared app token — cross-account leak).
 */
export async function bffFetch<T = unknown>(path: string): Promise<T> {
    const token = useAuthStore.getState().user?.token || ""
    if (!token) {
        throw new Error("BFF error 401: sin sesión")
    }

    const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
        throw new Error(`BFF error ${res.status}`)
    }

    return res.json()
}
