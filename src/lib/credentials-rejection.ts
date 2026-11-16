/**
 * Credenciales rechazadas por el proveedor (nota backend 2026-11-11, rama
 * `feat/aviso-credenciales-rechazadas`).
 *
 * Al primer rechazo, el backend pausa ESA configuración (automatización de la
 * propiedad, override del alojamiento o integración de KunasPMS) y ninguna
 * reserva vuelve a llamar al proveedor. La pausa se levanta solo cuando el PM
 * vuelve a guardar las credenciales en HIT.
 *
 * Tres señales, una por lugar:
 *   - `credentialsStatus` en el recurso (`null` = sin pausa).
 *   - `lastError: "credentials_rejected"` en cada reserva en espera.
 *   - 422 `code: "CREDENTIALS_REJECTED"` al despachar a mano durante la pausa.
 *
 * Todo lo de aquí llega por la red: se lee sin suponer la forma. Un objeto de
 * estado con campos que no se reconocen (un `reason` nuevo, un `status` raro)
 * se muestra igual como rechazo con texto genérico: ocultar un aviso de pausa
 * deja al PM sin saber por qué no se reporta nada. Lo que no es un objeto
 * (p. ej. un string) no tiene la forma del contrato y se lee como sin pausa.
 */

export const CREDENTIALS_REJECTED_ERROR = "credentials_rejected"
export const CREDENTIALS_REJECTED_CODE = "CREDENTIALS_REJECTED"

export interface CredentialsStatus {
    status: string
    /** Código estable del backend; el texto se traduce aquí. `null` si no vino. */
    reason: string | null
    /** Texto crudo del proveedor, si devolvió alguno. Nunca trae claves. */
    providerMessage: string | null
    /** ISO 8601; `null` si no vino o no se puede leer. */
    since: string | null
}

const REASON_TEXT: Record<string, string> = {
    token_rejected: "El Ministerio rechazó el token (puede haber cambiado o vencido).",
    login_rejected: "El usuario o la contraseña fueron rechazados.",
    company_missing: "La cuenta no está vinculada a ninguna empresa que reporte.",
    account_rejected: "El usuario o la contraseña de la cuenta TTLock fueron rechazados.",
    app_rejected: "Las credenciales de la app TTLock (client_id o client_secret) fueron rechazadas.",
}

const GENERIC_REASON = "El proveedor rechazó las credenciales."

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

/**
 * `credentialsStatus` (o `credentials_status`) de un recurso crudo.
 *   - `undefined` = la respuesta no trae el campo. NO significa «sin pausa»:
 *     la nota solo lo garantiza en los GET y en `configure`; pausar una
 *     integración o cambiar el estado de un override no levanta un rechazo. Quien
 *     guarda la respuesta conserva lo que ya sabía.
 *   - `null` = sin pausa (vino `null` o algo que no es un objeto).
 */
export function readCredentialsStatus(raw: unknown): CredentialsStatus | null | undefined {
    if (typeof raw !== "object" || raw === null) return undefined
    const record = raw as Record<string, unknown>
    if (!("credentialsStatus" in record) && !("credentials_status" in record)) return undefined
    const value = record.credentialsStatus ?? record.credentials_status
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null
    const status = value as Record<string, unknown>
    const since = text(status.since)
    return {
        status: text(status.status) ?? "rejected",
        reason: text(status.reason),
        providerMessage: text(status.providerMessage ?? status.provider_message),
        since: since && !Number.isNaN(Date.parse(since)) ? since : null,
    }
}

/** El texto del `reason`, o uno genérico si el código no se conoce. */
export function credentialsRejectionReason(reason: string | null | undefined): string {
    return (reason && REASON_TEXT[reason]) || GENERIC_REASON
}

/** «11 nov 2026, 8:15 a. m.», en la hora de Colombia como el resto del panel. */
export function formatRejectionSince(since: string | null): string | null {
    if (!since) return null
    const date = new Date(since)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Bogota",
    }).format(date)
}

/** `lastError` de una reserva en espera: string en `automation-status`, `{message}` en el historial. */
export function isCredentialsRejectedError(lastError: unknown): boolean {
    const raw = typeof lastError === "string"
        ? lastError
        : typeof lastError === "object" && lastError !== null
            ? (lastError as { message?: unknown }).message
            : null
    return typeof raw === "string" && raw.trim() === CREDENTIALS_REJECTED_ERROR
}

/**
 * El 422 del despacho manual durante la pausa. Se decide por `code`, nunca por
 * el texto (llega traducido). Devuelve el mensaje del backend para mostrarlo
 * tal cual; `null` = es otro error.
 */
export function readCredentialsRejectedDispatchError(error: unknown): { message: string } | null {
    if (typeof error !== "object" || error === null) return null
    const candidate = error as { status?: unknown; code?: unknown; message?: unknown }
    if (candidate.status !== 422 || candidate.code !== CREDENTIALS_REJECTED_CODE) return null
    return {
        message: text(candidate.message)
            ?? "Un proveedor rechazó las credenciales de esta automatización y está en pausa.",
    }
}
