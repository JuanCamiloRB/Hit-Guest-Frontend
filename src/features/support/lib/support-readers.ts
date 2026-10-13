/**
 * Lectura de las respuestas de `/support/*` (contrato de backend 2026-10-10,
 * skill de contratos §5b). Un campo ausente queda en `null` y la UI no lo
 * muestra: nunca se completa con un valor inventado. Una fila sin `uuid` se
 * descarta, porque sin él no se puede abrir nada.
 */

export interface SupportSession {
    uuid: string
    clientUuid: string | null
    clientName: string | null
    userUuid: string | null
    userName: string | null
    userEmail: string | null
    reason: string | null
    status: string | null
    /** Lo decide el backend (hoy 60): nunca se fija en el front. */
    idleTimeoutMinutes: number | null
    startedAt: string | null
    lastActivityAt: string | null
    expiresAt: string | null
}

export interface SupportClient {
    uuid: string
    name: string
    email: string | null
    identificationNumber: string | null
    usersCount: number | null
}

export interface SupportClientUser {
    uuid: string
    name: string
    email: string | null
    role: string | null
    isAccountOwner: boolean
    verified: boolean
    /** `false` = email sin verificar o personal de HIT: se muestra deshabilitado. */
    canOpenSession: boolean
}

export interface SupportAgent {
    uuid: string
    name: string
    email: string | null
    createdAt: string | null
    activeSession: SupportSession | null
}

export interface StartedSupportSession {
    token: string
    session: SupportSession
    /** El usuario objetivo, con la forma de `UserResource`. */
    user: Record<string, unknown>
}

export interface PageMeta {
    currentPage: number
    lastPage: number
    total: number | null
}

export interface Page<T> {
    items: T[]
    meta: PageMeta
}

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null
}

function count(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

export function readSupportSession(raw: unknown): SupportSession | null {
    const r = record(raw)
    const uuid = text(r?.uuid)
    if (!r || !uuid) return null
    return {
        uuid,
        clientUuid: text(r.clientUuid),
        clientName: text(r.clientName),
        userUuid: text(r.userUuid),
        userName: text(r.userName),
        userEmail: text(r.userEmail),
        reason: text(r.reason),
        status: text(r.status),
        idleTimeoutMinutes: count(r.idleTimeoutMinutes),
        startedAt: text(r.startedAt),
        lastActivityAt: text(r.lastActivityAt),
        expiresAt: text(r.expiresAt),
    }
}

export function readSupportClient(raw: unknown): SupportClient | null {
    const r = record(raw)
    const uuid = text(r?.uuid)
    if (!r || !uuid) return null
    return {
        uuid,
        name: text(r.name) ?? text(r.email) ?? "Cliente sin nombre",
        email: text(r.email),
        identificationNumber: text(r.identificationNumber),
        usersCount: count(r.usersCount),
    }
}

export function readSupportClientUser(raw: unknown): SupportClientUser | null {
    const r = record(raw)
    const uuid = text(r?.uuid)
    if (!r || !uuid) return null
    return {
        uuid,
        name: text(r.name) ?? text(r.email) ?? "Usuario sin nombre",
        email: text(r.email),
        role: text(r.role),
        isAccountOwner: r.isAccountOwner === true,
        verified: r.verified === true,
        // Solo un `true` explícito habilita la entrada.
        canOpenSession: r.canOpenSession === true,
    }
}

export function readSupportAgent(raw: unknown): SupportAgent | null {
    const r = record(raw)
    const uuid = text(r?.uuid)
    if (!r || !uuid) return null
    return {
        uuid,
        name: text(r.name) ?? text(r.email) ?? "Agente sin nombre",
        email: text(r.email),
        createdAt: text(r.createdAt),
        activeSession: readSupportSession(r.activeSession),
    }
}

export function readPageMeta(raw: unknown, itemCount: number): PageMeta {
    const meta = record(record(raw)?.meta)
    const current = count(meta?.current_page)
    const last = count(meta?.last_page)
    return {
        currentPage: current && current >= 1 ? current : 1,
        lastPage: last && last >= 1 ? last : 1,
        total: count(meta?.total) ?? (meta ? null : itemCount),
    }
}

/**
 * `data {token, session, user}` del 201 de `POST /support/sessions`. Acepta el
 * cuerpo crudo o ya desenvuelto por `apiClient`. `null` si falta algo esencial:
 * sin token no hay sesión, y sin `session` no hay banner.
 */
export function readStartedSupportSession(raw: unknown): StartedSupportSession | null {
    const root = record(raw)
    const r = record(root?.data) ?? root
    const token = text(r?.token)
    const session = readSupportSession(r?.session)
    const user = record(r?.user)
    if (!token || !session || !user) return null
    return { token, session, user }
}
