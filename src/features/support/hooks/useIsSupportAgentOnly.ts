"use client"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"
import { isSupportAgentOnly } from "../lib/support-access"

/**
 * Agente de soporte puro FUERA del modo soporte (contrato §5b): no es PM, el
 * panel normal le muestra la cuenta interna de HIT y toda acción le da 403.
 * Única fuente para el guard de rutas, el encabezado y los banners de cuenta.
 * `false` antes de hidratar: no se decide con una sesión que todavía no se leyó.
 */
export function useIsSupportAgentOnly(): boolean {
    const isHydrated = useHasHydrated()
    const { user, isInSupportSession } = useAuth()
    return isHydrated && !isInSupportSession && isSupportAgentOnly(user)
}
