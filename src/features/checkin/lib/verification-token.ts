/**
 * Almacenamiento del `verificationToken` (plan OTP 20260731 — "Dónde guardar el
 * verificationToken en el cliente"). sessionStorage, NO localStorage: el token
 * es de sesión, vence a los 60 minutos en el servidor, y no debe sobrevivir
 * entre pestañas/dispositivos — a diferencia del resto de los datos del checkin
 * (sesión de identify, borradores del formulario), que sí usan localStorage a
 * propósito para sobrevivir a una pestaña cerrada.
 *
 * Indexado por reservationUuid + guestUuid (un acompañante de la misma reserva
 * tiene su propio token independiente).
 *
 * Este módulo sabe UNA sola cosa: guardar, leer y borrar el token respetando su
 * vencimiento. No navega, no avisa al huésped, no decide qué pantalla sigue —
 * de eso se encarga `useVerificationRecovery`.
 *
 * ## Por qué el vencimiento vive acá
 *
 * `VerifyContactChallengeResponse.expiresAt` dice cuándo muere el token, y
 * antes se descartaba: se guardaba solo el string. La consecuencia era que el
 * front no podía distinguir "token vivo" de "token muerto" y solo se enteraba
 * cuando el backend respondía 401 — en el peor momento posible, que es el envío
 * final, después de que el huésped llenara el formulario, leyera el contrato y
 * FIRMARA. Sabiendo el vencimiento, un token vencido se comporta igual que uno
 * ausente en todo el flujo, y el rebote ocurre temprano en vez de después del
 * trabajo perdido.
 */

/** Margen para no entregar un token que vence durante el viaje de la petición. */
const EXPIRY_MARGIN_MS = 30_000

interface StoredToken {
    token: string
    /** ISO del backend. `null` para tokens legacy guardados sin vencimiento. */
    expiresAt: string | null
}

function storageKey(reservationUuid: string, guestUuid: string): string {
    return `checkin-verification-token-${reservationUuid}-${guestUuid}`
}

/**
 * Formato actual (JSON) y el legacy (string pelado) conviven a propósito: al
 * desplegar este cambio hay huéspedes con un token ya guardado en el formato
 * viejo, y descartarlos los expulsaría a mitad del checkin. Un token legacy se
 * acepta sin vencimiento conocido — si de verdad está vencido, el 401 del
 * backend lo resuelve como siempre.
 */
function parseStored(raw: string): StoredToken {
    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object" && typeof parsed.token === "string") {
            return {
                token: parsed.token,
                expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
            }
        }
    } catch {
        // No era JSON → formato legacy.
    }
    return { token: raw, expiresAt: null }
}

/** `true` si ya venció (con margen). Una fecha ilegible se trata como vigente. */
function isExpired(expiresAt: string | null, now: number): boolean {
    if (!expiresAt) return false
    const ms = Date.parse(expiresAt)
    if (Number.isNaN(ms)) return false
    return now >= ms - EXPIRY_MARGIN_MS
}

/**
 * El token vigente, o `null` si no hay o ya venció. Un token vencido se borra
 * en el momento: dejarlo sería tener basura que solo sirve para provocar 401s.
 */
export function getVerificationToken(reservationUuid: string, guestUuid: string): string | null {
    try {
        const raw = sessionStorage.getItem(storageKey(reservationUuid, guestUuid))
        if (!raw) return null

        const stored = parseStored(raw)
        if (isExpired(stored.expiresAt, Date.now())) {
            clearVerificationToken(reservationUuid, guestUuid)
            return null
        }
        return stored.token
    } catch {
        return null
    }
}

/**
 * `"absent"` — este huésped nunca tuvo token, y es legítimo: solo el recurrente
 * que pasó por el OTP tiene uno. El que hizo biometría no lo necesita.
 * `"expired"` — SÍ tenía uno y venció. Es un caso distinto de "absent" y hay
 * que poder distinguirlos: permite rebotarlo antes de que gaste trabajo, en vez
 * de esperar al 401 del envío final.
 *
 * De solo lectura a propósito: a diferencia de `getVerificationToken`, no borra
 * el token vencido, porque quien pregunta el estado todavía necesita saber que
 * existió.
 */
export type VerificationTokenState = "absent" | "valid" | "expired"

export function getVerificationTokenState(
    reservationUuid: string,
    guestUuid: string,
): VerificationTokenState {
    try {
        const raw = sessionStorage.getItem(storageKey(reservationUuid, guestUuid))
        if (!raw) return "absent"
        return isExpired(parseStored(raw).expiresAt, Date.now()) ? "expired" : "valid"
    } catch {
        return "absent"
    }
}

/**
 * @param expiresAt ISO que devuelve `/contact-challenges/{id}/verify`. Omitirlo
 * guarda el token sin vencimiento — solo para llamadores que genuinamente no lo
 * reciben.
 */
export function setVerificationToken(
    reservationUuid: string,
    guestUuid: string,
    token: string,
    expiresAt?: string | null,
): void {
    try {
        const payload: StoredToken = { token, expiresAt: expiresAt ?? null }
        sessionStorage.setItem(storageKey(reservationUuid, guestUuid), JSON.stringify(payload))
    } catch {
        // Storage no disponible (modo privado, cuota) — al huésped se le pedirá
        // el OTP otra vez en la próxima llamada protegida, sin romper nada.
    }
}

export function clearVerificationToken(reservationUuid: string, guestUuid: string): void {
    try {
        sessionStorage.removeItem(storageKey(reservationUuid, guestUuid))
    } catch {
        // no-op
    }
}
