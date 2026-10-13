"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoadingState } from "@/components/ui/loading-state"
import { useIsSupportAgentOnly } from "../hooks/useIsSupportAgentOnly"
import { SUPPORT_HOME } from "../lib/support-session"

/** Rutas que un agente puro sí puede ver: la consola y la administración de agentes. */
export function isSupportRoute(pathname: string): boolean {
    return pathname === SUPPORT_HOME || pathname.startsWith(`${SUPPORT_HOME}/`)
}

/**
 * El agente puro no entra al panel normal (contrato §5b): cualquier otra ruta
 * del dashboard lo devuelve a la consola, y mientras tanto no se monta la
 * página (que pediría datos de la cuenta interna de HIT).
 */
export function SupportAgentRouteGuard({ children }: { children: React.ReactNode }) {
    const agentOnly = useIsSupportAgentOnly()
    const pathname = usePathname()
    const router = useRouter()
    const blocked = agentOnly && !isSupportRoute(pathname)

    useEffect(() => {
        if (blocked) router.replace(SUPPORT_HOME)
    }, [blocked, router])

    return blocked ? <LoadingState rows={3} label="Abriendo la consola de soporte" /> : <>{children}</>
}

/** Pinta su contenido solo para quien usa el panel de una cuenta (no para el agente puro). */
export function AccountChromeOnly({ children }: { children: React.ReactNode }) {
    return useIsSupportAgentOnly() ? null : <>{children}</>
}
