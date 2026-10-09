/**
 * Lectura de las respuestas del plano de superusuario. ⚠️ Contrato PEDIDO,
 * todavía no emitido por el backend (`docs/BACKEND_NEEDS_IMPERSONATION.md`
 * §2 y §4): estos lectores son la única pieza que habrá que ajustar si la
 * forma real difiere. Toleran camelCase y snake_case; un campo ausente queda en
 * `null` y la UI no lo muestra, nunca se completa con un valor inventado.
 */

import type { ImpersonationMode } from "./session-access"

export interface AdminClientOwner {
    uuid: string | null
    name: string | null
    email: string | null
}

export interface AdminClientCounts {
    users: number | null
    properties: number | null
    listings: number | null
    reservations: number | null
}

export interface AdminClient {
    uuid: string
    name: string
    status: string | null
    email: string | null
    owner: AdminClientOwner | null
    balance: { amount: number; currency: string } | null
    counts: AdminClientCounts
    createdAt: string | null
}

export interface AdminClientUser {
    uuid: string
    name: string
    email: string | null
    isAccountOwner: boolean
    roles: string[]
    status: string | null
    lastLoginAt: string | null
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

export interface StartedImpersonation {
    id: string
    token: string
    mode: ImpersonationMode
    startedAt: string | null
    expiresAt: string | null
    /** El usuario suplantado, con la forma de `GET /user`. */
    user: Record<string, unknown>
}

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null
}

function count(value: unknown): number | null {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null
}

function readOwner(raw: unknown): AdminClientOwner | null {
    const r = record(raw)
    if (!r) return null
    const owner = { uuid: text(r.uuid), name: text(r.name), email: text(r.email) }
    return owner.uuid || owner.name || owner.email ? owner : null
}

function readBalance(raw: unknown): AdminClient["balance"] {
    const r = record(raw)
    const amount = count(r?.amount) ?? (typeof r?.amount === "number" ? r.amount : null)
    const currency = text(r?.currency)
    return amount != null && currency ? { amount, currency } : null
}

export function readAdminClient(raw: unknown): AdminClient | null {
    const r = record(raw)
    const uuid = text(r?.uuid)
    if (!r || !uuid) return null
    const counts = record(r.counts) ?? {}
    return {
        uuid,
        name: text(r.name) ?? "Cliente sin nombre",
        status: text(r.status),
        email: text(r.email),
        // El listado puede traer el dueño plano (`ownerEmail`) en vez de anidado.
        owner: readOwner(r.owner) ?? (text(r.ownerEmail ?? r.owner_email)
            ? { uuid: null, name: null, email: text(r.ownerEmail ?? r.owner_email) }
            : null),
        balance: readBalance(r.balance),
        counts: {
            users: count(counts.users ?? r.usersCount ?? r.users_count),
            properties: count(counts.properties ?? r.propertiesCount ?? r.properties_count),
            listings: count(counts.listings),
            reservations: count(counts.reservations),
        },
        createdAt: text(r.createdAt ?? r.created_at),
    }
}

export function readAdminClientUser(raw: unknown): AdminClientUser | null {
    const r = record(raw)
    const uuid = text(r?.uuid)
    if (!r || !uuid) return null
    const roles = Array.isArray(r.roles)
        ? r.roles.filter((role): role is string => typeof role === "string" && role.trim() !== "")
        : text(r.role) ? [String(r.role)] : []
    return {
        uuid,
        name: text(r.name) ?? text(r.email) ?? "Usuario sin nombre",
        email: text(r.email),
        isAccountOwner: r.isAccountOwner === true || r.is_account_owner === true,
        roles,
        status: text(r.status),
        lastLoginAt: text(r.lastLoginAt ?? r.last_login_at),
    }
}

export function readPageMeta(raw: unknown, itemCount: number): PageMeta {
    const meta = record(record(raw)?.meta)
    const current = count(meta?.current_page ?? meta?.currentPage)
    const last = count(meta?.last_page ?? meta?.lastPage)
    return {
        currentPage: current && current >= 1 ? current : 1,
        lastPage: last && last >= 1 ? last : 1,
        total: count(meta?.total) ?? (meta ? null : itemCount),
    }
}

/** `{data: {id, token, mode, startedAt, expiresAt, user}}` (§2.1). `null` si falta algo esencial. */
export function readStartedImpersonation(raw: unknown): StartedImpersonation | null {
    const root = record(raw)
    const r = record(root?.data) ?? root
    const id = text(r?.id)
    const token = text(r?.token)
    const user = record(r?.user)
    if (!r || !id || !token || !user) return null
    return {
        id,
        token,
        mode: r.mode === "full" ? "full" : "read_only",
        startedAt: text(r.startedAt ?? r.started_at),
        expiresAt: text(r.expiresAt ?? r.expires_at),
        user,
    }
}

/** Mensaje para cada rechazo documentado al iniciar (§2.5); `null` = usar el del backend. */
export function describeImpersonationError(code: string | undefined): string | null {
    switch (code) {
        case "IMPERSONATION_FORBIDDEN":
            return "Tu cuenta no tiene permiso para entrar a cuentas de clientes."
        case "IMPERSONATION_FULL_FORBIDDEN":
            return "No tienes permiso para iniciar una sesión con escritura."
        case "TARGET_USER_INACTIVE":
            return "Ese usuario está inactivo o fue eliminado."
        case "TARGET_CLIENT_INACTIVE":
            return "La cuenta de ese cliente está suspendida."
        case "CANNOT_IMPERSONATE_SUPER_ADMIN":
            return "No se puede entrar a la cuenta de otro superusuario."
        case "CANNOT_IMPERSONATE_SELF":
            return "No puedes entrar a tu propia cuenta como otro usuario."
        case "NESTED_IMPERSONATION_FORBIDDEN":
            return "Ya estás dentro de otra cuenta. Vuelve a la tuya antes de entrar a otra."
        default:
            return null
    }
}
