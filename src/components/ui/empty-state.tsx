import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * - `empty`: todavía no hay nada (sin reservas, sin unidades). Título con lo
 *   que iría aquí y, si existe, la acción que crea el primero («Crear reserva»).
 *   Es parte fija de la pantalla: no se anuncia.
 * - `no-results`: hay datos, pero el filtro o la búsqueda no encontró nada.
 *   Título con lo buscado («Sin resultados para "Casa Mar"») y la acción que
 *   lo deshace («Limpiar filtros»), nunca «crear». Aparece por algo que hizo
 *   el usuario, así que se anuncia sin interrumpir (`status`).
 */
type EmptyStateKind = "empty" | "no-results"

/** Lo que decide cómo se anuncia; se aplica después del spread (ver FeedbackBanner). */
type ControlledAttribute = "role" | "aria-live" | "aria-atomic" | "aria-relevant" | "aria-busy"

interface EmptyStateProps extends Omit<React.ComponentProps<"div">, ControlledAttribute> {
    /** Qué falta, en palabras del usuario. */
    title: string
    /** Por qué está vacío o qué hacer. Opcional: se omite cuando es obvio. */
    description?: string
    /** Ilustración decorativa: siempre 2xl, trazo light, en ink-4. */
    icon?: LucideIcon
    /** La acción que llena el vacío (`empty`) o deshace el filtro (`no-results`). */
    action?: React.ReactNode
    kind?: EmptyStateKind
}

const ANNOUNCEMENT: Record<EmptyStateKind, {
    role: "status" | undefined
    "aria-live": "polite" | undefined
    "aria-atomic": "true" | undefined
    "aria-relevant": undefined
    "aria-busy": undefined
}> = {
    empty: { role: undefined, "aria-live": undefined, "aria-atomic": undefined, "aria-relevant": undefined, "aria-busy": undefined },
    "no-results": { role: "status", "aria-live": "polite", "aria-atomic": "true", "aria-relevant": undefined, "aria-busy": undefined },
}

/**
 * El vacío de listas y paneles. Una lista vacía es un momento para orientar,
 * no un error: decir qué iría aquí y, cuando existe, dar la acción siguiente.
 * Un error de carga NO es un vacío: es un `FeedbackBanner` de error.
 */
function EmptyState({
    title,
    description,
    icon,
    action,
    kind = "empty",
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            {...props}
            {...ANNOUNCEMENT[kind]}
            data-slot="empty-state"
            data-kind={kind}
            className={cn(
                "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
                className,
            )}
        >
            {icon && <Icon icon={icon} size="2xl" weight="light" className="mb-1 text-ink-4" />}
            <p className="text-sm font-semibold text-ink">{title}</p>
            {description && <p className="max-w-sm text-xs text-ink-3">{description}</p>}
            {action && <div className="mt-3">{action}</div>}
        </div>
    )
}

export { EmptyState, type EmptyStateKind }
