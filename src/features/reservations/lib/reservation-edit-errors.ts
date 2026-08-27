/**
 * Extracción de los errores 422 del PUT|POST de reservas (contrato 2026-08-24,
 * skill §2g.5) para anclarlos al campo real del formulario.
 *
 * El envelope trae `errors` como Record camelCase → array de mensajes YA
 * LOCALIZADOS por `X-Locale`. Regla del contrato y del patrón de error-UX del
 * repo: el mensaje del backend se muestra TAL CUAL (es el único que trae el
 * detalle específico), nunca se recompone en cliente. Esta función solo
 * extrae; a qué control del formulario se ancla cada clave lo decide el
 * formulario, que es quien conoce sus campos.
 */

export interface ReservationFieldError {
    /** Clave camelCase tal como la nombra el backend (`externalId`, `listingId`…). */
    field: string
    /** Primer mensaje de esa clave, localizado, para mostrar tal cual. */
    message: string
}

export function readReservationFieldErrors(error: unknown): ReservationFieldError[] {
    const record = error && typeof error === "object" ? error as Record<string, unknown> : {}
    const errors = record.errors
    if (!errors || typeof errors !== "object" || Array.isArray(errors)) return []

    const result: ReservationFieldError[] = []
    for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
        const message = Array.isArray(value)
            ? value.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
            : typeof value === "string" && value.trim() ? value : undefined
        if (!message) continue
        result.push({ field, message })
    }
    return result
}
