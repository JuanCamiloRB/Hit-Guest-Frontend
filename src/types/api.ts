export interface ApiResponse<T> {
    data: T
}

export interface OcrFailedField {
    field: string
    reason: string
    confidence?: number
}

export interface ApiErrorResponse {
    message: string
    errors?: (string | Record<string, string[]>)[] | Record<string, string[]>
    /** OCR / document-verification failures (e.g. CRITICAL_FIELD_ERROR). */
    errorType?: string
    failedFields?: OcrFailedField[]
}

export class ApiError extends Error {
    public status: number
    public message: string
    public errors?: (string | Record<string, string[]>)[] | Record<string, string[]>
    public errorType?: string
    public failedFields?: OcrFailedField[]

    constructor(status: number, data: ApiErrorResponse) {
        super(data.message)
        this.status = status
        this.message = data.message
        this.errors = data.errors
        this.errorType = data.errorType
        this.failedFields = data.failedFields
    }
}
