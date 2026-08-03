import { toast } from "sonner"

/**
 * Centralized backend-error notifier.
 *
 * The backend returns localized error messages (Spanish when X-Locale: es is sent)
 * across endpoints, sometimes with structured field-level detail:
 *   - Laravel validation:  { message, errors: { field: [msg], ... } }
 *   - OCR / documents:     { message, errorType, failedFields: [{ field, reason, confidence }] }
 *
 * Both `apiClient` (ApiError) and the checkin service (buildHttpError) attach these
 * to the thrown error. `notifyError(e, fallback)` extracts the best message + detail
 * and shows a consistent toast, so every screen surfaces the real reason instead of a
 * generic string.
 */

interface NormalizedError {
    message: string
    status?: number
    /** Optional field-level lines (validation / OCR failures). */
    details: string[]
}

/** OCR failure reason codes → short Spanish. */
const REASON_LABELS: Record<string, string> = {
    NOT_FOUND: "no se encontró",
    UNCLEAR: "poco claro",
    MISMATCH: "no coincide",
    EXPIRED: "vencido",
    INVALID: "inválido",
    LOW_CONFIDENCE: "poco legible",
}

/** Common field keys → Spanish labels (for OCR failedFields). */
const FIELD_LABELS: Record<string, string> = {
    name: "Nombre",
    firstName: "Nombre",
    first_name: "Nombre",
    lastname: "Apellido",
    lastName: "Apellido",
    last_name: "Apellido",
    documentNumber: "Número de documento",
    identificationNumber: "Número de documento",
    dateOfBirth: "Fecha de nacimiento",
    expirationDate: "Fecha de vencimiento",
}

const DEFAULT_FALLBACK = "Algo salió mal. Intenta de nuevo en unos minutos."

/**
 * Turns any thrown value (Error, ApiError, buildHttpError result, plain object,
 * or string) into a normalized { message, status, details }.
 */
export function normalizeApiError(error: unknown, fallback = DEFAULT_FALLBACK): NormalizedError {
    if (typeof error === "string") return { message: error || fallback, details: [] }

    const e = error as any
    const status = typeof e?.status === "number" ? e.status : undefined
    let message: string =
        typeof e?.message === "string" && e.message.trim() ? e.message : fallback

    // 403 = recurso de otra cuenta (policy). Laravel's default text is English
    // ("This action is unauthorized.") — replace it; keep any localized message.
    if (status === 403 && /unauthorized|forbidden|this action/i.test(message)) {
        message = "No tienes permiso para acceder a este recurso."
    }

    const details: string[] = []

    // OCR-style structured failures: failedFields: [{ field, reason, confidence }]
    if (Array.isArray(e?.failedFields)) {
        for (const f of e.failedFields) {
            const label = FIELD_LABELS[f?.field] || f?.field || ""
            const reason = REASON_LABELS[f?.reason] || (f?.reason ? String(f.reason).toLowerCase() : "")
            if (label) details.push(reason ? `${label}: ${reason}` : String(label))
        }
    }

    // Validation errors: array of strings, Record<string, string[]>, or array of records.
    const errs = e?.errors
    if (errs) {
        const pushVal = (v: unknown) => {
            if (Array.isArray(v)) v.forEach((x) => details.push(String(x)))
            else if (v != null) details.push(String(v))
        }
        if (Array.isArray(errs)) {
            for (const item of errs) {
                if (typeof item === "string") details.push(item)
                else if (item && typeof item === "object") Object.values(item).forEach(pushVal)
            }
        } else if (typeof errs === "object") {
            Object.values(errs).forEach(pushVal)
        }
    }

    // De-duplicate (a field msg may also appear in the top-level message).
    const unique = [...new Set(details)].filter((d) => d && d !== message)
    return { message, status, details: unique }
}

/**
 * Shows the backend error as a toast. Use in catch blocks instead of
 * `toast.error("mensaje genérico")` so the real (localized) reason is surfaced.
 *
 * @param error    The thrown error / rejection.
 * @param fallback Message to show when the backend gave none.
 */
export function notifyError(error: unknown, fallback = DEFAULT_FALLBACK): void {
    const { message, details } = normalizeApiError(error, fallback)
    const description = details.length ? details.slice(0, 5).join("\n") : undefined
    toast.error(message, description ? { description } : undefined)
}

/** Extracts just the localized message (no toast) — for inline display. */
export function getErrorMessage(error: unknown, fallback = DEFAULT_FALLBACK): string {
    return normalizeApiError(error, fallback).message
}
