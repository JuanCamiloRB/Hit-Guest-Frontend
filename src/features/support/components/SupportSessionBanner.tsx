"use client"

import { useEffect, useState } from "react"
import { Headset, Loader2, LogOut } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"
import { useAuthStore } from "@/lib/store/auth-store"
import { ApiError } from "@/types/api"
import { supportService } from "../services/support-service"
import { exitSupportSession, leaveEndedSupportSession } from "../lib/support-session"

/**
 * Franja fija del modo soporte (contrato §6): de quién es la cuenta, como quién
 * se entró, cuándo se cierra y la salida. No se puede cerrar y se pinta en todo
 * el dashboard, para que no haya pantalla en la que se olvide que no es la
 * cuenta propia.
 *
 * Al montarse (también tras recargar) consulta `GET /support/sessions/current`:
 * 200 refresca los datos; 404 `SUPPORT_SESSION_NOT_FOUND` sale localmente; un
 * 401 lo resuelve el cliente HTTP, que vuelve a la consola.
 */
export function SupportSessionBanner() {
    const isHydrated = useHasHydrated()
    const { user, isInSupportSession } = useAuth()
    const [leaving, setLeaving] = useState(false)

    useEffect(() => {
        if (!isHydrated || !isInSupportSession) return
        let active = true
        supportService.getCurrentSession()
            .then((session) => { if (active) useAuthStore.getState().updateSupportSession(session) })
            .catch((error) => {
                if (active && error instanceof ApiError && error.status === 404) leaveEndedSupportSession()
            })
        return () => { active = false }
    }, [isHydrated, isInSupportSession])

    if (!isHydrated || !isInSupportSession || !user) return null

    const session = user.supportSession ?? null
    const clientName = session?.clientName ?? user.clientName ?? "esta cuenta"
    const userName = session?.userName ?? user.firstName ?? "este usuario"
    const userEmail = session?.userEmail ?? user.email ?? null
    const idleMinutes = session?.idleTimeoutMinutes ?? null

    const leave = async () => {
        setLeaving(true)
        await exitSupportSession()
    }

    return (
        <div
            role="region"
            aria-label="Modo soporte"
            className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-amber-400 px-4 py-2.5 text-slate-900"
        >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Headset size={16} aria-hidden className="shrink-0" />
                <strong>Modo soporte</strong>
                <span>
                    · Estás en la cuenta de <strong>{clientName}</strong> como <strong>{userName}</strong>
                    {userEmail ? ` (${userEmail})` : ""}
                </span>
                {idleMinutes != null && (
                    <span className="text-xs text-slate-800">· Se cierra tras {idleMinutes} min sin actividad</span>
                )}
            </p>
            <button
                type="button"
                onClick={() => void leave()}
                disabled={leaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
            >
                {leaving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <LogOut size={15} aria-hidden />}
                Salir
            </button>
        </div>
    )
}
