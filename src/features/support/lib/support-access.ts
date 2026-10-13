/**
 * Quién ve la consola de soporte, leído de `UserResource` (`data.user` de
 * `POST /auth/verify-otp`). Contrato de backend del 2026-10-10 (skill de
 * contratos §5b): dos booleanos. Solo un `true` explícito habilita; ausente o
 * con otro tipo es «no», así que con un backend que todavía no los emite toda
 * la UI de soporte queda oculta y no llama a nada.
 */

export interface SupportFlags {
    /** `support_agent` y `super_admin`: menú y pantalla «Consola de soporte». */
    canAccessSupportConsole: boolean
    /** Solo `super_admin`: menú y pantalla «Agentes de soporte». */
    canManageSupportAgents: boolean
}

export function readSupportFlags(raw: unknown): SupportFlags {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
    return {
        canAccessSupportConsole: r.canAccessSupportConsole === true,
        canManageSupportAgents: r.canManageSupportAgents === true,
    }
}

/**
 * Agente de soporte puro: entra a la consola pero no administra agentes. No es
 * PM: su usuario vive en la cuenta interna de HIT, así que el panel normal le
 * muestra datos de esa cuenta y cualquier acción responde 403. Por eso su
 * inicio es la consola y no ve el menú normal fuera del modo soporte.
 */
export function isSupportAgentOnly(user: Partial<SupportFlags> | null | undefined): boolean {
    return user?.canAccessSupportConsole === true && user.canManageSupportAgents !== true
}
