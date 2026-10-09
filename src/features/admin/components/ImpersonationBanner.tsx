"use client"

import { useState } from "react"
import { Eye, Loader2, Undo2 } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"
import { exitImpersonatedAccount } from "../lib/impersonation-session"

function formatTime(iso: string | null | undefined): string | null {
    if (!iso) return null
    const date = new Date(iso)
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
}

/**
 * Franja fija mientras el superusuario está dentro de la cuenta de otro
 * usuario: de quién es la cuenta, como quién se entró, el modo y cuándo vence,
 * y la salida. Se pinta en todo el dashboard (AdminLayout) para que no haya
 * pantalla en la que se pueda olvidar que no es la cuenta propia.
 */
export function ImpersonationBanner() {
    const isHydrated = useHasHydrated()
    const { user, isImpersonating } = useAuth()
    const [leaving, setLeaving] = useState(false)

    if (!isHydrated || !isImpersonating || !user) return null

    const impersonation = user.impersonation ?? null
    const readOnly = impersonation?.mode !== "full"
    const expiresAt = formatTime(impersonation?.expiresAt)
    const clientName = user.clientName ?? "esta cuenta"
    const who = user.firstName || user.email || "este usuario"

    const leave = async () => {
        setLeaving(true)
        await exitImpersonatedAccount()
    }

    return (
        <div
            role="region"
            aria-label="Estás dentro de la cuenta de otro usuario"
            className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-amber-400 px-4 py-2.5 text-slate-900"
        >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Eye size={16} aria-hidden className="shrink-0" />
                <span>
                    Estás dentro de la cuenta de <strong>{clientName}</strong> como <strong>{who}</strong>
                    {user.isAccountOwner ? " (dueño de la cuenta)" : ""}.
                </span>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold tracking-wide text-amber-200">
                    {readOnly ? "SOLO LECTURA" : "CON ESCRITURA"}
                </span>
                {expiresAt && <span className="text-xs text-slate-800">Vence a las {expiresAt}</span>}
            </p>
            <button
                type="button"
                onClick={() => void leave()}
                disabled={leaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
            >
                {leaving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Undo2 size={15} aria-hidden />}
                Volver a mi cuenta de superusuario
            </button>
        </div>
    )
}
