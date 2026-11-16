/**
 * Volver a donde iba el PM después de iniciar sesión.
 *
 * Caso que lo motivó (nota backend 2026-11-11 §6.3): el correo de «credenciales
 * rechazadas» enlaza a la pantalla de automatizaciones de una propiedad. Con la
 * sesión vencida, el 401 mandaba a `/login` a secas y, tras el código, al inicio
 * del panel: el enlace se perdía.
 *
 * El destino viaja en la URL, así que se valida como dato ajeno: solo rutas
 * internas del panel (`/dashboard…`). Nada de `//host`, `\\`, esquemas ni
 * caracteres de control: un `returnTo` que no pasa se ignora (va al inicio),
 * nunca se sigue.
 */

export const RETURN_TO_PARAM = "returnTo"

const SAFE_PATH = /^\/dashboard(?:[/?#]|$)/

export function safeReturnTo(raw: string | null | undefined): string | null {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null
    if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null
    if (!SAFE_PATH.test(raw)) return null
    // Una ruta que resuelve fuera del panel (`/dashboard/../login`) tampoco vale.
    try {
        const resolved = new URL(raw, "https://panel.invalid")
        if (resolved.origin !== "https://panel.invalid" || !SAFE_PATH.test(resolved.pathname)) return null
        return `${resolved.pathname}${resolved.search}${resolved.hash}`
    } catch {
        return null
    }
}

/** `/login`, con el destino si es una ruta del panel. */
export function loginHref(currentPath: string | null | undefined): string {
    const target = safeReturnTo(currentPath)
    return target ? `/login?${RETURN_TO_PARAM}=${encodeURIComponent(target)}` : "/login"
}

/** El destino que trae la URL del login (`?returnTo=`), ya validado. */
export function readReturnTo(search: string): string | null {
    return safeReturnTo(new URLSearchParams(search).get(RETURN_TO_PARAM))
}
