/**
 * Entrar a la cuenta de otro usuario y volver, sin cerrar nunca la sesión del
 * superusuario (pedido de producto 2026-10-09).
 *
 * El aislamiento entre cuentas se resuelve con una NAVEGACIÓN COMPLETA al
 * entrar y al salir: varias cachés de módulo guardan datos de la cuenta
 * (`usePortfolio`, la lista de reservas en vuelo…) y no están segmentadas por
 * cliente. Recargar el documento las reinicia todas, también las que se
 * agreguen después, en vez de depender de que cada una se acuerde de limpiarse.
 */

import { mapUserResponse } from "@/features/auth/services/auth-service"
import { useAuthStore } from "@/lib/store/auth-store"
import { adminService } from "../services/admin-service"
import type { StartedImpersonation } from "./admin-readers"

type Navigate = (url: string) => void

const hardNavigate: Navigate = (url) => {
    window.location.assign(url)
}

export const ACCOUNT_HOME = "/dashboard"
export const ADMIN_HOME = "/dashboard/admin/clients"

/** Entra con el token que emitió el backend. Lanza si ya se está dentro de otra cuenta. */
export function enterImpersonatedAccount(started: StartedImpersonation, navigate: Navigate = hardNavigate): void {
    const state = useAuthStore.getState()
    const actor = state.user
    if (!actor || state.actor) {
        throw new Error("Ya estás dentro de otra cuenta. Vuelve a la tuya antes de entrar a otra.")
    }
    const target = mapUserResponse(started.user, started.token)
    target.impersonation = {
        id: started.id,
        actorUuid: actor.uuid ?? actor.id ?? null,
        actorEmail: actor.email || null,
        mode: started.mode,
        startedAt: started.startedAt,
        expiresAt: started.expiresAt,
    }
    if (!state.beginImpersonation(target)) {
        throw new Error("No se pudo entrar a la cuenta.")
    }
    navigate(ACCOUNT_HOME)
}

/**
 * Vuelve a la cuenta del superusuario. Primero se restaura su sesión y DESPUÉS
 * se revoca la suplantación: la revocación va con el token del actor (§2.4 del
 * pedido), nunca con el suplantado. Si la revocación falla, el token vence solo:
 * no se retiene al usuario en la cuenta ajena por eso.
 */
export async function exitImpersonatedAccount(navigate: Navigate = hardNavigate): Promise<void> {
    const state = useAuthStore.getState()
    if (!state.actor) return
    const impersonationId = state.user?.impersonation?.id ?? null
    state.endImpersonation()
    if (impersonationId) {
        try {
            await adminService.revokeImpersonation(impersonationId)
        } catch (error) {
            console.warn("[impersonation] no se pudo revocar; vencerá sola:", error)
        }
    }
    navigate(ADMIN_HOME)
}
