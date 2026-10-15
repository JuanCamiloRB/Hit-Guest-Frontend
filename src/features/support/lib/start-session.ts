import { getErrorMessage } from "@/lib/notify-error"
import { ApiError } from "@/types/api"

/** Mínimo del contrato (§4): el backend responde 422 en `errors.reason` por debajo. */
export const REASON_MIN = 10

export function supportReasonError(reason: string): string | null {
    return reason.trim().length < REASON_MIN
        ? `Explica el motivo con al menos ${REASON_MIN} caracteres (por ejemplo, «Ticket 77: revisar contrato»).`
        : null
}

/** Primer mensaje del backend para un campo de un 422, si lo trae. */
function fieldError(error: unknown, field: string): string | null {
    if (!(error instanceof ApiError) || error.status !== 422) return null
    const errors = error.errors
    if (!errors || Array.isArray(errors)) return null
    const messages = errors[field]
    return Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : null
}

export type StartError = { field: "reason" | null; message: string; userGone: boolean }

/** Traduce un rechazo de `POST /support/sessions` (contrato §7) a qué mostrar y dónde. */
export function describeStartError(error: unknown): StartError {
    const reason = fieldError(error, "reason")
    if (reason) return { field: "reason", message: reason, userGone: false }
    const userUuid = fieldError(error, "userUuid")
    if (userUuid) return { field: null, message: userUuid, userGone: true }
    if (error instanceof ApiError && error.status === 429) {
        return { field: null, message: "Espera un momento e intenta de nuevo.", userGone: false }
    }
    // 403 `SUPPORT_TARGET_NOT_ALLOWED` y el resto: el `message` del backend.
    return { field: null, message: getErrorMessage(error, "No se pudo abrir la sesión de soporte."), userGone: false }
}

/** Con un solo usuario habilitado, ya viene elegido: el caso más común es un clic menos. */
export function defaultSupportUser<T extends { uuid: string; canOpenSession: boolean }>(users: readonly T[]): string | null {
    const openable = users.filter((u) => u.canOpenSession)
    return openable.length === 1 ? openable[0].uuid : null
}
