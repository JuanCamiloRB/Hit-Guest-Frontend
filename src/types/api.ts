export interface ApiResponse<T> {
    data: T
}

export interface OcrFailedField {
    field: string
    reason: string
    confidence?: number
}

/**
 * Cara del documento que falló, como la mandan la captura del huésped y la
 * subida del PM (`failedFields: ["front"|"back"]`), a diferencia del OCR, que
 * manda objetos `{field, reason}`.
 */
export type DocumentSide = "front" | "back"
export type FailedFieldValue = OcrFailedField | DocumentSide

export interface ApiErrorResponse {
    message: string
    errors?: (string | Record<string, string[]>)[] | Record<string, string[]>
    /** OCR / document-verification failures (e.g. CRITICAL_FIELD_ERROR). */
    errorType?: string
    failedFields?: FailedFieldValue[]
    /** Código estable del error, cuando el backend lo manda (`SUPPORT_TARGET_NOT_ALLOWED`…). */
    code?: string
}

export class ApiError extends Error {
    public status: number
    public message: string
    public errors?: (string | Record<string, string[]>)[] | Record<string, string[]>
    public errorType?: string
    public failedFields?: FailedFieldValue[]
    public code?: string

    constructor(status: number, data: ApiErrorResponse) {
        super(data.message)
        this.status = status
        this.message = data.message
        this.errors = data.errors
        this.errorType = data.errorType
        this.failedFields = data.failedFields
        this.code = typeof data.code === "string" ? data.code : undefined
    }
}

function isFailedFieldValue(value: unknown): value is FailedFieldValue {
    if (value === "front" || value === "back") return true
    return !!value && typeof value === "object" && typeof (value as { field?: unknown }).field === "string"
}

function isErrorsShape(value: unknown): value is NonNullable<ApiErrorResponse["errors"]> {
    return Array.isArray(value) || (!!value && typeof value === "object")
}

/**
 * Un cuerpo de error del backend leído campo a campo, para los `fetch` directos
 * que no pasan por `apiClient` (subidas multipart). Solo conserva lo que tiene
 * la forma esperada; sin `message` usa el de respaldo.
 */
export function toApiErrorResponse(raw: unknown, fallbackMessage: string): ApiErrorResponse {
    const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    return {
        message: typeof body.message === "string" && body.message.trim() ? body.message : fallbackMessage,
        ...(isErrorsShape(body.errors) ? { errors: body.errors } : {}),
        ...(typeof body.errorType === "string" ? { errorType: body.errorType } : {}),
        ...(Array.isArray(body.failedFields) ? { failedFields: body.failedFields.filter(isFailedFieldValue) } : {}),
        ...(typeof body.code === "string" ? { code: body.code } : {}),
    }
}
