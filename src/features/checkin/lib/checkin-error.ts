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

/** Detalle por campo de un rechazo de OCR (§17). */
export interface CheckinFailedField {
    field: string
    reason: string
    confidence?: number
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
