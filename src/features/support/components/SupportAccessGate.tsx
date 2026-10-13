"use client"

import { ShieldAlert } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"

/**
 * Puerta de las pantallas de soporte. Sin el flag explícito en la sesión no se
 * monta nada de lo de adentro, así que tampoco se llama a `/support/*`. En modo
 * soporte tampoco: el token de soporte es el del usuario del cliente.
 */
export function SupportAccessGate({
    requires,
    children,
}: {
    requires: "console" | "agents"
    children: React.ReactNode
}) {
    const isHydrated = useHasHydrated()
    const { user, isInSupportSession } = useAuth()

    if (!isHydrated) return <LoadingState rows={4} label="Cargando" />

    if (isInSupportSession) {
        return (
            <EmptyState
                icon={<ShieldAlert aria-hidden />}
                title="Estás en modo soporte"
                description="Sal de la sesión de soporte (en la franja de arriba) para volver a la consola."
            />
        )
    }

    const allowed = requires === "agents"
        ? user?.canManageSupportAgents === true
        : user?.canAccessSupportConsole === true
    if (!allowed) {
        return (
            <EmptyState
                icon={<ShieldAlert aria-hidden />}
                title="Esta sección es solo para el equipo de soporte"
                description="Tu cuenta no tiene acceso a esta pantalla."
            />
        )
    }

    return <>{children}</>
}
