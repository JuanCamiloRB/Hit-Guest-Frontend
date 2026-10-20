/**
 * Subida de fotos del documento de un huésped EXONERADO por el PM (contrato
 * 2026-10-15, skill de contratos §2c-ter). Reglas puras: quién ve el botón y
 * dónde va cada error.
 */

import { getErrorMessage } from "@/lib/notify-error"
import { ApiError } from "@/types/api"

/** Solo con una exoneración activa, antes y después de completar; sin exigir ser dueño. */
export function canUploadWaivedDocuments(guest: { identityWaiver: unknown }): boolean {
    return guest.identityWaiver != null
}

export interface WaiverUploadErrorView {
    front: string | null
    back: string | null
    /** Error general del formulario. */
    form: string | null
    /** El huésped o la exoneración ya no existen: hay que refrescar la ficha. */
    refresh: boolean
}

const NONE: WaiverUploadErrorView = { front: null, back: null, form: null, refresh: false }

function firstMessage(errors: unknown, ...keys: string[]): string | null {
    if (!errors || typeof errors !== "object" || Array.isArray(errors)) return null
    for (const key of keys) {
        const messages = (errors as Record<string, unknown>)[key]
        if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0]
    }
    return null
}

/** `failedFields` llega como `["front"|"back"]` (captura/PM) u objetos `{field}`. */
function failedSides(raw: unknown): Array<"front" | "back"> {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((item) => {
        const side = typeof item === "string" ? item : (item as { field?: unknown })?.field
        return side === "front" || side === "back" ? [side] : []
    })
}

/**
 * Del rechazo del backend a qué mostrar y dónde. Se decide por estado HTTP,
 * `errorType` y claves de `errors` — nunca por el texto, que llega traducido.
 */
export function describeWaiverUploadError(error: unknown): WaiverUploadErrorView {
    if (!(error instanceof ApiError)) {
        return { ...NONE, form: getErrorMessage(error, "No se pudieron subir las fotos. Intenta de nuevo.") }
    }
    const message = error.message || "No se pudieron subir las fotos."
    if (error.status === 404) return { ...NONE, form: message, refresh: true }
    if (error.status !== 422) return { ...NONE, form: message }

    if (error.errorType === "DOCUMENT_NOT_DETECTED") {
        const sides = failedSides(error.failedFields)
        if (sides.length === 0) return { ...NONE, form: message }
        return { ...NONE, front: sides.includes("front") ? message : null, back: sides.includes("back") ? message : null }
    }
    if (error.errorType === "SERVICE_UNAVAILABLE") {
        return { ...NONE, form: `${message} Las fotos anteriores, si había, siguen guardadas.` }
    }
    if (error.errorType) return { ...NONE, form: message }

    const front = firstMessage(error.errors, "frontImage", "front_image")
    const back = firstMessage(error.errors, "backImage", "back_image")
    if (front || back) return { ...NONE, front, back }
    // 422 con solo `message`: la exoneración ya no está activa (la revocaron).
    return { ...NONE, form: message, refresh: true }
}
