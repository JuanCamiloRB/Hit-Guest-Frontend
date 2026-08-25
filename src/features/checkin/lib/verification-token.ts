/**
 * Almacenamiento del `verificationToken` (plan OTP 20260731 — "Dónde guardar el
 * verificationToken en el cliente").
 *
 * ## Por qué `localStorage` — corregido el 2026-08-19
 *
 * Antes vivía en `sessionStorage`, razonando que el token «no debe sobrevivir
 * entre pestañas». El problema es que **todo el estado que ese token acompaña ya
 * vive en `localStorage`**: la sesión de identify (`useIdentifySession`), el
 * borrador del formulario, los datos del OCR y el pendiente de Didit. Con dos
 * vidas distintas para un mismo estado, el huésped que volvía al portal —pestaña
 * descartada por iOS, link abierto otra vez desde el correo, salto del navegador
 * in-app de Gmail/WhatsApp a Safari— se encontraba con el flujo a medio camino y
 * **sin la credencial que ese flujo necesita**: `/form` respondía 401, se le
 * decía «tu sesión expiró» y volvía al OTP, una y otra vez.
 *
 * Qué NO cambia con esto: sigue sin cruzar entre dispositivos ni entre
 * navegadores distintos (ningún almacenamiento web lo hace), y sigue muriendo
 * por `expiresAt` —el servidor lo vence a los 60 minutos y acá se borra solo al
 * leerlo—. Lo que cambia es que deja de morir por cerrar una pestaña.
 *
 * El modelo de amenaza tampoco se mueve materialmente: el `guestUuid` y el resto
 * de la sesión del huésped ya estaban en `localStorage`, así que el token no
 * agrega una superficie nueva — y a diferencia de esos datos, se autodestruye.
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
    /**
     * Duración de la ventana OBSERVADA al guardar (`expiresAt - ahora`), para
     * espejar el TTL deslizante del backend (2026-08-24: cada request que pasa
     * el gate renueva la expiración). Las respuestas gateadas NO traen el
     * `expiresAt` nuevo, y el contrato prohíbe quemar los 60 min — extender por
     * la duración observada es lo único que no inventa. `null` en registros
     * guardados antes de este cambio: esos no se extienden.
     */
    ttlMs: number | null
}

function storageKey(reservationUuid: string, guestUuid: string): string {
    return `checkin-verification-token-${reservationUuid}-${guestUuid}`
}

/**
 * Lee el valor crudo, migrando el que haya quedado en `sessionStorage`.
 *
 * La migración no es cosmética: al desplegar el cambio de almacenamiento hay
 * huéspedes con el token guardado en el sitio viejo, a mitad del check-in.
 * Ignorarlo los expulsaría al OTP — justo el bug que este cambio corrige.
 */
function readRaw(key: string): string | null {
    const current = localStorage.getItem(key)
    if (current) return current

    const legacy = sessionStorage.getItem(key)
    if (!legacy) return null
    // Se mueve, no se copia: dejarlo en los dos lados haría que borrar el token
    // en uno dejara vivo al otro.
    localStorage.setItem(key, legacy)
    sessionStorage.removeItem(key)
    return legacy
}

/**
 * Formato actual (JSON) y el legacy (string pelado) conviven a propósito: al
 * desplegar este cambio hay huéspedes con un token ya guardado en el formato
 * viejo, y descartarlos los expulsaría a mitad del checkin. Un token legacy se
 * acepta sin vencimiento conocido — si de verdad está vencido, el 401 del
 * backend lo resuelve como siempre.
 */
function parseStored(raw: string): StoredToken | null {
    const trimmed = raw.trim()
    // Solo un valor que NO sea un objeto JSON puede ser un token legacy.
    //
    // Antes se intentaba `JSON.parse` sobre cualquier cosa y, si el objeto no
    // traía un `token` string, se caía igual al camino legacy y se devolvía **el
    // JSON entero como si fuese el token**. Con eso el front mandaba
    // `X-Checkin-Verification-Token: {"expiresAt":"…"}`, el backend lo rechazaba
    // con 401, el huésped volvía al OTP, se guardaba la misma basura otra vez…
    // y el check-in no avanzaba nunca. Peor: ese valor se guardaba sin
    // `expiresAt`, así que se consideraba vigente para siempre y jamás se
    // auto-limpiaba.
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed)
            if (parsed && typeof parsed === "object") {
                const token = typeof parsed.token === "string" ? parsed.token.trim() : ""
                if (!token) return null
                const ttlMs = Number(parsed.ttlMs)
                return {
                    token,
                    expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
                    ttlMs: Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : null,
                }
            }
        } catch {
            // Un JSON roto tampoco es un token legacy: era nuestro formato y se
            // corrompió. Tratarlo como credencial garantizaría un 401.
            return null
        }
    }
    return trimmed ? { token: trimmed, expiresAt: null, ttlMs: null } : null
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
        const raw = readRaw(storageKey(reservationUuid, guestUuid))
        if (!raw) return null

        const stored = parseStored(raw)
        // Guardado corrupto: se borra en el momento. Mandarlo produciría un 401
        // que el flujo interpretaría como "sesión expirada", devolviendo al
        // huésped a un OTP que no arregla nada.
        if (!stored) {
            clearVerificationToken(reservationUuid, guestUuid)
            return null
        }
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
        const raw = readRaw(storageKey(reservationUuid, guestUuid))
        if (!raw) return "absent"
        const stored = parseStored(raw)
        // Un guardado corrupto no es una credencial: para el flujo es como no
        // tenerla. Reportarlo "valid" hacía que los chequeos previos dieran vía
        // libre a una llamada condenada al 401.
        if (!stored) return "absent"
        return isExpired(stored.expiresAt, Date.now()) ? "expired" : "valid"
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
): boolean {
    // El tipo promete `string`, así que TypeScript da este caso por imposible —
    // por eso hay que comprobarlo en runtime: describe lo que el contrato
    // promete, no lo que la respuesta trae. Guardar un token vacío o ausente no
    // dejaba un hueco: dejaba basura que se mandaba como credencial y devolvía
    // 401 en cada llamada del check-in.
    const clean = typeof token === "string" ? token.trim() : ""
    if (!clean) {
        console.error(
            "[verification-token] El backend no devolvió un `verificationToken` usable en "
            + "/contact-challenges/{id}/verify; no se guarda nada. El huésped no podrá continuar "
            + "hasta que ese endpoint devuelva el token que documenta el contrato.",
        )
        clearVerificationToken(reservationUuid, guestUuid)
        return false
    }

    try {
        // Captura la ventana observada para el TTL deslizante: solo una fecha
        // futura legible produce un ttl; cualquier otra cosa deja `null` y ese
        // token simplemente no se extiende (nunca se inventa una duración).
        const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN
        const ttlMs = Number.isFinite(expiresMs) && expiresMs > Date.now()
            ? expiresMs - Date.now()
            : null
        const payload: StoredToken = { token: clean, expiresAt: expiresAt ?? null, ttlMs }
        localStorage.setItem(storageKey(reservationUuid, guestUuid), JSON.stringify(payload))
        return true
    } catch {
        // Storage no disponible (modo privado, cuota). Devolver `false` es lo que
        // permite a quien llama NO mandar al huésped a un paso que va a rebotar:
        // sin credencial, la siguiente llamada protegida responde 401.
        console.error("[verification-token] No se pudo persistir el token de verificación.")
        return false
    }
}

/**
 * Espeja el TTL deslizante del backend (2026-08-24): cada request que pasa el
 * gate renueva el token del servidor a 60 min desde ese momento, pero las
 * respuestas gateadas no devuelven el `expiresAt` nuevo — así que al ENVIAR el
 * token se extiende la copia local por la misma duración observada al
 * guardarlo. Sin esto, el vencimiento local fijo se vuelve pesimista y expulsa
 * al OTP a un huésped cuyo token el servidor mantiene vivo (el falso positivo
 * crece cuanto más trabajó: formulario, documentos, contrato).
 *
 * Si la extensión resulta optimista (petición que nunca llegó, TTL acortado en
 * backend), el gate responde 401 con `code` y la recuperación borra el token —
 * el mismo camino de siempre. Un token legacy sin `ttlMs` no se extiende.
 */
export function touchVerificationToken(reservationUuid: string, guestUuid: string): void {
    try {
        const key = storageKey(reservationUuid, guestUuid)
        const raw = readRaw(key)
        if (!raw) return
        const stored = parseStored(raw)
        if (!stored || !stored.ttlMs || isExpired(stored.expiresAt, Date.now())) return
        localStorage.setItem(key, JSON.stringify({
            ...stored,
            expiresAt: new Date(Date.now() + stored.ttlMs).toISOString(),
        }))
    } catch {
        // no-op: extender el reloj local es una optimización, nunca un requisito.
    }
}

export function clearVerificationToken(reservationUuid: string, guestUuid: string): void {
    try {
        const key = storageKey(reservationUuid, guestUuid)
        localStorage.removeItem(key)
        // También el sitio viejo: un token sin migrar todavía resucitaría en la
        // siguiente lectura.
        sessionStorage.removeItem(key)
    } catch {
        // no-op
    }
}
