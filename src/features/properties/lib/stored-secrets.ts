/**
 * Quién ve un secreto (nota backend 2026-11-12, «quién ve las credenciales»).
 *
 * El backend manda el valor de un secreto (token de TRA, contraseña de SIRE,
 * contraseña y `client_secret` de TTLock) solo al dueño de la propiedad, a un
 * agente de HIT en sesión de soporte sobre él y a `super_admin`. A los demás
 * les llega `parameters` SIN esa clave, con `storedSecretKeys` diciendo que
 * existe y, para el token de TRA y el `client_secret`, `secretHints` con los
 * últimos 4.
 *
 * El frontend no sabe el rol: lo deduce de lo que llega, una sola vez, aquí.
 *  - `visible`: el valor llegó → quien mira es el dueño; se edita con un campo
 *    de contraseña con mostrar/ocultar.
 *  - `hidden`: está guardado pero el valor no llegó → no es el dueño; se muestra
 *    «Guardada» (con la pista si la hay) y no se edita.
 *  - `missing`: no hay nada guardado (o el backend es anterior a la nota y no
 *    lo dice) → campo vacío, editable.
 */

export type SecretPresence =
    | { kind: "visible" }
    | { kind: "hidden"; hint: string | null }
    | { kind: "missing" }

export interface SecretSource {
    parameters?: Record<string, unknown> | null
    storedSecretKeys?: string[]
    secretHints?: Record<string, string>
}

function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === "string") return value.trim() !== ""
    return true
}

export function secretPresence(source: SecretSource | null | undefined, key: string): SecretPresence {
    if (hasValue(source?.parameters?.[key])) return { kind: "visible" }
    if (source?.storedSecretKeys?.includes(key)) return { kind: "hidden", hint: source.secretHints?.[key] ?? null }
    return { kind: "missing" }
}

/** Hay valor para esta clave, visible o guardado sin verse. Para decidir si una credencial falta. */
export function hasCredentialValue(source: SecretSource | null | undefined, key: string): boolean {
    return secretPresence(source, key).kind !== "missing"
}

/** Lo que se muestra de un secreto que no se ve: nunca el valor, a lo sumo los últimos 4. */
export function maskedSecret(hint: string | null): string {
    return hint ? `••••${hint}` : "••••••••"
}
