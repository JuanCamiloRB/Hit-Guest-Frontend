export interface ApiResponse<T> {
    data: T
}

export interface ApiErrorResponse {
    message: string
    errors?: (string | Record<string, string[]>)[]
}

export class ApiError extends Error {
    public status: number
    public message: string
    public errors?: (string | Record<string, string[]>)[]

    constructor(status: number, data: ApiErrorResponse) {
        super(data.message)
        this.status = status
        this.message = data.message
        this.errors = data.errors
    }
}
