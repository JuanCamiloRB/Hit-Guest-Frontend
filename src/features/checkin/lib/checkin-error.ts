/**
 * El error que produce `CheckinService.buildHttpError()`, con nombre y forma.
 *
 * El portal habla con endpoints que devuelven CUATRO formas de error distintas
 * (§0 del contrato): el `{message}` genérico de Laravel, el `{message, errors}`
 * de validación, el `{code, message, attemptsRemaining|retryAfter}` de los
 * contact-challenges, y el `{success, errorType, message, failedFields}` de la
 * subida de documentos. El servicio ya las aplana en un solo `Error` con
 * propiedades extra, pero ese contrato no estaba escrito en ningún lado: cada
 * pantalla lo redescubría con un `catch (e: any)` y leía los campos a ciegas.
 *
 * Tenerlo tipado no es cosmético — `any` desactiva el chequeo por completo, así
 * que un `e.retryAfer` mal escrito compilaba y fallaba en silencio a las 3 de la
 * mañana, en la pantalla del huésped.
 */

/**
 * Detalle por campo de un rechazo de subida de documento. Dos contratos, una
 * forma interna: el OCR (§17) manda `{field, reason, confidence}`; la captura
 * sin verificación (2026-09-27, `DOCUMENT_NOT_DETECTED`) manda solo el lado,
 * `"front" | "back"`, como string. `normalizeFailedFields` los une acá, en la
 * frontera, para que ninguna pantalla vuelva a preguntar «¿string u objeto?».
 */
export interface CheckinFailedField {
    field: string
    /** `null` cuando el backend solo señaló el campo, sin motivo. */
    reason: string | null
    confidence?: number
}

export function normalizeFailedFields(raw: unknown): CheckinFailedField[] {
    if (!Array.isArray(raw)) return []
    const fields: CheckinFailedField[] = []
    for (const item of raw) {
        if (typeof item === "string" && item.trim() !== "") {
            fields.push({ field: item, reason: null })
            continue
        }
        if (item && typeof item === "object" && typeof (item as { field?: unknown }).field === "string") {
            const record = item as { field: string; reason?: unknown; confidence?: unknown }
            fields.push({
                field: record.field,
                reason: typeof record.reason === "string" ? record.reason : null,
                ...(typeof record.confidence === "number" ? { confidence: record.confidence } : {}),
            })
        }
    }
    return fields
}

/**
 * Estado de la verificación que trae CADA respuesta de la subida OCR (§17,
 * contrato 2026-10-03), también los 422: cuántos intentos quedan y si el
 * huésped todavía puede reintentar. Solo lo leído con el tipo correcto entra;
 * una clave ausente queda `undefined` (backend anterior), nunca un default.
 */
export interface UploadVerificationSnapshot {
    canRetry?: boolean
    attemptsRemaining?: number
    failureReason?: string | null
}

export function readUploadVerification(raw: unknown): UploadVerificationSnapshot | undefined {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
    const v = raw as Record<string, unknown>
    const canRetry = v.canRetry ?? v.can_retry
    const attempts = v.attemptsRemaining ?? v.attempts_remaining
    const reason = v.failureReason ?? v.failure_reason
    const snapshot: UploadVerificationSnapshot = {
        ...(typeof canRetry === "boolean" ? { canRetry } : {}),
        ...(typeof attempts === "number" && Number.isFinite(attempts) ? { attemptsRemaining: attempts } : {}),
        ...(typeof reason === "string" || reason === null ? { failureReason: reason } : {}),
    }
    return Object.keys(snapshot).length > 0 ? snapshot : undefined
}

export interface CheckinApiError extends Error {
    /** Código HTTP. Ausente si el fallo fue de red y nunca hubo respuesta. */
    status?: number
    /** Errores de validación de Laravel, en camelCase (§0). */
    errors?: Record<string, string[]>
    /** Código de rechazo de OCR/face-match (§17), p. ej. `FACE_MISMATCH`. */
    errorType?: string
    failedFields?: CheckinFailedField[]
    /** Código de los contact-challenges (§8/§9): `INVALID_CODE`, `TOO_MANY_ATTEMPTS`… */
    code?: string
    attemptsRemaining?: number
    /** Segundos de espera: del body, o rescatado del header `Retry-After`. */
    retryAfter?: number
    /** Bloque `verification` de la subida OCR (§17, contrato 2026-10-03). */
    verification?: UploadVerificationSnapshot
}

/**
 * Reinterpreta un valor atrapado como error del portal.
 *
 * Siempre devuelve algo utilizable: en un `catch` puede llegar cualquier cosa
 * (un string, un `undefined`, un rechazo de una librería), y obligar a cada
 * pantalla a comprobarlo es justo lo que llevaba al `any`. Los campos que no
 * estén simplemente quedan `undefined`, que es como ya se los leía.
 */
export function asCheckinError(error: unknown): CheckinApiError {
    if (error instanceof Error) return error as CheckinApiError
    if (typeof error === "string") return new Error(error) as CheckinApiError
    return new Error("Error en la solicitud") as CheckinApiError
}
