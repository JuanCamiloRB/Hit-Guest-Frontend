"use client"

import { ShieldAlert } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useHasHydrated } from "@/hooks/useHasHydrated"
import { ADMIN_CAPABILITIES, hasCapability } from "../lib/session-access"

/**
 * Puerta del plano de superusuario. Sin la capacidad explícita en la sesión
 * no se monta nada de lo de adentro, así que tampoco se llama a ningún
 * endpoint `/admin/*`. Dentro de una cuenta ajena tampoco: el token suplantado
 * no tiene acceso a ese plano (contrato pedido §2.2).
 */
export function AdminAccessGate({ children }: { children: React.ReactNode }) {
    const isHydrated = useHasHydrated()
    const { user, isImpersonating } = useAuth()

    if (!isHydrated) return <LoadingState rows={4} label="Cargando" />

    if (isImpersonating) {
        return (
            <EmptyState
                icon={<ShieldAlert aria-hidden />}
                title="Estás dentro de la cuenta de un cliente"
                description="Vuelve a tu cuenta de superusuario (en la franja de arriba) para usar el directorio de clientes."
            />
        )
    }

    if (!hasCapability(user, ADMIN_CAPABILITIES.clientsRead)) {
        return (
            <EmptyState
                icon={<ShieldAlert aria-hidden />}
                title="Esta sección es solo para superusuarios"
                description="Tu cuenta no tiene acceso al directorio de clientes."
            />
        )
    }

    return <>{children}</>
}
