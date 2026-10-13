/**
 * Entrar en modo soporte y volver, sin cerrar nunca la sesión del agente
 * (contrato de backend 2026-10-10, skill de contratos §5b).
 *
 * El contrato pide vaciar estado y caché al entrar y al salir. Se resuelve con
 * una NAVEGACIÓN COMPLETA: varias cachés de módulo guardan datos de la cuenta
 * (`usePortfolio`, la lista de reservas en vuelo…) y no están segmentadas por
 * cliente. Recargar el documento las reinicia todas, también las que se
 * agreguen después, en vez de depender de que cada una se acuerde de limpiarse.
 */

import { mapUserResponse } from "@/features/auth/services/auth-service"
import { useAuthStore } from "@/lib/store/auth-store"
import { supportService } from "../services/support-service"
import type { StartedSupportSession } from "./support-readers"

type Navigate = (url: string) => void

const hardNavigate: Navigate = (url) => {
    window.location.assign(url)
}

export const ACCOUNT_HOME = "/dashboard"
export const SUPPORT_HOME = "/dashboard/support"
/** Destino cuando la sesión de soporte se cerró sola: la consola avisa. */
export const SUPPORT_ENDED_URL = `${SUPPORT_HOME}?session=ended`

/** Entra con el token que emitió el backend y navega al inicio del panel del cliente. */
export function enterSupportSession(started: StartedSupportSession, navigate: Navigate = hardNavigate): void {
    const state = useAuthStore.getState()
    if (!state.user || state.actor) {
        throw new Error("Ya estás en modo soporte. Sal de esa sesión antes de abrir otra.")
    }
    const target = mapUserResponse(started.user, started.token)
    target.supportSession = started.session
    if (!state.beginSupportSession(target)) {
        throw new Error("No se pudo abrir la sesión de soporte.")
    }
    navigate(ACCOUNT_HOME)
}

/**
 * Sale del modo soporte a pedido del agente: primero cierra la sesión en el
 * backend con el token de soporte (todavía activo), y después vuelve a la
 * sesión del agente. Si el cierre falla, se sale igual: el agente no queda
 * retenido en la cuenta del cliente, y la sesión vence sola por inactividad.
 */
export async function exitSupportSession(navigate: Navigate = hardNavigate): Promise<void> {
    const state = useAuthStore.getState()
    if (!state.actor) return
    try {
        await supportService.endCurrentSession()
    } catch (error) {
        console.warn("[support] no se pudo cerrar la sesión de soporte; vencerá por inactividad:", error)
    }
    useAuthStore.getState().endSupportSession()
    navigate(SUPPORT_HOME)
}

/**
 * La sesión de soporte ya está cerrada (401, venció, se reemplazó o se revocó
 * al agente): vuelve a la sesión del agente SIN llamar a `end`.
 */
export function leaveEndedSupportSession(navigate: Navigate = hardNavigate): void {
    useAuthStore.getState().endSupportSession()
    navigate(SUPPORT_ENDED_URL)
}
