/**
 * Maps a thrown ApiError into inline field errors for the Kunas forms.
 *
 * The backend returns Laravel-style `errors: { field: [msg, ...] }`. Auth
 * failures against KunasPMS come back as 401 with `errors.credentials` (an
 * array), which we distinguish from a session-token 401 (no `errors` body).
 */

import { ApiError } from "@/types/api"

export interface IntegrationFieldErrors {
    token?: string
    email?: string
    password?: string
    name?: string
    /** KunasPMS credential rejection (401 with errors.credentials). */
    credentials?: string
}

/** Read the first message for a key from a Laravel `errors` map. */
function firstMessage(
    errors: Record<string, string[]> | undefined,
    key: string,
): string | undefined {
    const msgs = errors?.[key]
    return Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : undefined
}

/**
 * Pull inline field errors from an ApiError. Returns an empty object when the
 * error carries no field-level detail (caller should fall back to a toast).
 */
export function extractFieldErrors(error: unknown): IntegrationFieldErrors {
    if (!(error instanceof ApiError)) return {}

    // ApiError.errors may be a map or (rarely) an array; only the map form
    // carries field keys.
    const map =
        error.errors && !Array.isArray(error.errors)
            ? (error.errors as Record<string, string[]>)
            : undefined

    return {
        token: firstMessage(map, "token"),
        email: firstMessage(map, "email"),
        password: firstMessage(map, "password"),
        name: firstMessage(map, "name"),
        credentials: firstMessage(map, "credentials"),
    }
}

/** True when the error is a KunasPMS credential rejection (not a session 401). */
export function isCredentialError(error: unknown): boolean {
    return (
        error instanceof ApiError &&
        error.status === 401 &&
        !Array.isArray(error.errors) &&
        Boolean((error.errors as Record<string, string[]> | undefined)?.credentials)
    )
}

/** True when the resource doesn't exist (no integration / integration removed). */
export function isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404
}
