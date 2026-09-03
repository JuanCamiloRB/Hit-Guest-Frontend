import { ApiError } from "@/types/api"

/**
 * Qué contarle al PM cuando `POST /billing/checkout` falla.
 *
 * Un 422 trae el ÚNICO detalle específico de todo el intercambio — «El monto
 * mínimo de recarga es $10.00 USD.», ya localizado por `X-Locale` (observado
 * por curl el 2026-09-03) — así que se muestra TAL CUAL. Antes ese caso caía al
 * genérico «Inténtalo de nuevo en unos minutos», que para un error de
 * validación es un consejo falso: reintentar no cambia el monto.
 *
 * Cualquier otro fallo (un 500 de Stripe, la red) sí es transitorio y conserva
 * el genérico. No hay más ramas a propósito: son los únicos comportamientos
 * observados del endpoint, y una rama para un código nunca visto termina
 * tragándose a la de al lado.
 */
export function rechargeErrorDescription(error: unknown): string {
    if (error instanceof ApiError && error.status === 422) {
        const serverMessage = error.message?.trim() || firstFieldMessage(error.errors)
        if (serverMessage) return serverMessage
    }
    return "Inténtalo de nuevo en unos minutos."
}

/** Primer mensaje de campo del envelope Laravel, tolerando sus dos formas. */
function firstFieldMessage(errors: ApiError["errors"]): string {
    const values = Array.isArray(errors) ? errors : Object.values(errors ?? {})
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value
        if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0]
        if (value && typeof value === "object") {
            const nested = Object.values(value).flat().find((v) => typeof v === "string" && v.trim())
            if (nested) return nested as string
        }
    }
    return ""
}
