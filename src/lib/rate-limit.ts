/**
 * Freno compartido ante un 429 del backend.
 *
 * El límite de Laravel es por cuenta y por minuto, no por ruta: cuando una
 * consulta recibe 429, las que esperan turno en una cola (el consumo por
 * reserva del Tablero, el semáforo de Operaciones) van a recibir lo mismo.
 * Seguir disparándolas solo alarga el bloqueo. Aquí se anota hasta cuándo
 * rige, y las cargas MASIVAS lo consultan antes de salir a la red. Una acción
 * del usuario (guardar, reintentar) no se frena aquí: va al backend y que él
 * responda.
 */

/** Sin `Retry-After`, lo que dura la ventana de Laravel por omisión. */
export const RATE_LIMIT_DEFAULT_MS = 60_000

let blockedUntil = 0

export class RateLimitedError extends Error {
    readonly status = 429
    constructor(public readonly retryAt: number) {
        super("Demasiadas consultas en poco tiempo")
        this.name = "RateLimitedError"
    }
}

/** Un 429 acaba de llegar; `retryAfterSeconds` es su cabecera, si vino. */
export function noteRateLimited(retryAfterSeconds?: number | null): void {
    const ms = retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : RATE_LIMIT_DEFAULT_MS
    blockedUntil = Math.max(blockedUntil, Date.now() + ms)
}

export function isRateLimited(now = Date.now()): boolean {
    return now < blockedUntil
}

/** Momento (epoch ms) hasta el que rige el freno; 0 si no rige. */
export function rateLimitedUntil(): number {
    return isRateLimited() ? blockedUntil : 0
}

/** Para una carga en cola: falla en el acto si el freno rige, sin red. */
export function throwIfRateLimited(): void {
    if (isRateLimited()) throw new RateLimitedError(blockedUntil)
}

/** ¿Este fallo es (o viene de) un 429? */
export function isRateLimitError(error: unknown): boolean {
    return error instanceof RateLimitedError
        || (typeof error === "object" && error !== null && (error as { status?: unknown }).status === 429)
}

/** Solo para tests. */
export function resetRateLimit(): void {
    blockedUntil = 0
}
