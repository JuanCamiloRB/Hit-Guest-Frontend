/**
 * Qué puede hacer la sesión en el plano de superusuario, leído de `GET /user`
 * y `POST /auth/verify-otp`. ⚠️ Contrato PEDIDO, todavía no emitido por el
 * backend (`docs/BACKEND_NEEDS_IMPERSONATION.md` §1 y §3): mientras no lleguen
 * estas claves, todo lo de este módulo responde «sin acceso» y la UI de
 * superusuario no se muestra ni llama a nada.
 *
 * La UI decide SOLO por capacidades explícitas, nunca por un dominio de correo
 * ni por un rol inferido: un valor ausente o con otro tipo es «no».
 */

export const ADMIN_CAPABILITIES = {
    clientsRead: "admin.clients.read",
    impersonateReadOnly: "admin.impersonate.read_only",
    impersonateFull: "admin.impersonate.full",
} as const

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[keyof typeof ADMIN_CAPABILITIES]

export type ImpersonationMode = "read_only" | "full"

/** Bloque `impersonation` de `GET /user` con un token suplantado (§3). */
export interface ImpersonationInfo {
    id: string
    actorUuid: string | null
    actorEmail: string | null
    mode: ImpersonationMode
    startedAt: string | null
    expiresAt: string | null
}

function stringList(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
        : []
}

function optionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null
}

export function readCapabilities(raw: unknown): string[] {
    if (!raw || typeof raw !== "object") return []
    return stringList((raw as Record<string, unknown>).capabilities)
}

/** `roles` como arreglo (contrato pedido); un `role` suelto se acepta como uno solo. */
export function readRoles(raw: unknown): string[] {
    if (!raw || typeof raw !== "object") return []
    const r = raw as Record<string, unknown>
    const roles = stringList(r.roles)
    if (roles.length > 0) return roles
    const single = optionalString(r.role)
    return single ? [single] : []
}

export function readImpersonation(raw: unknown): ImpersonationInfo | null {
    if (!raw || typeof raw !== "object") return null
    const block = (raw as Record<string, unknown>).impersonation
    if (!block || typeof block !== "object") return null
    const b = block as Record<string, unknown>
    const id = optionalString(b.id)
    // Sin id no hay suplantación utilizable: no se puede revocar ni auditar.
    if (!id) return null
    return {
        id,
        actorUuid: optionalString(b.actorUuid ?? b.actor_uuid),
        actorEmail: optionalString(b.actorEmail ?? b.actor_email),
        // Cualquier valor que no sea explícitamente `full` se trata como solo lectura.
        mode: b.mode === "full" ? "full" : "read_only",
        startedAt: optionalString(b.startedAt ?? b.started_at),
        expiresAt: optionalString(b.expiresAt ?? b.expires_at),
    }
}

export function hasCapability(
    user: { capabilities?: readonly string[] } | null | undefined,
    capability: AdminCapability,
): boolean {
    return Array.isArray(user?.capabilities) && user.capabilities.includes(capability)
}
