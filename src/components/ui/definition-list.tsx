import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/**
 * Un término y su definición dentro de un `<dl>` (DS-8c, 2026-11-13): el dato
 * de una ficha («Llegada · 12 mar»), un contacto, un canal de envío. Había tres
 * versiones a mano, una de ellas con el ícono fuera del grupo `dt/dd` (en un
 * `<dl>` solo caben `dt`, `dd` y `div`).
 *
 * - El ícono va DENTRO del `dt` (decorativo) y la definición se alinea con el
 *   texto del término (16 px de ícono + 6 px de separación = `pl-5.5`).
 * - `prominent`: la definición es el dato (base, bold); si no, texto normal
 *   (`sm`, ink) donde la pantalla pone un `TextLink`, un `StatusPill`…
 * - `hint`: una segunda definición pequeña del mismo término (un `<p>` dentro
 *   del `dl` rompía la lista para el lector).
 *
 * El `<dl>` y su layout (`space-y-3`, grilla) los pone la pantalla: es layout.
 */
interface DefinitionItemProps extends Omit<React.ComponentProps<"div">, "title"> {
    label: React.ReactNode
    icon?: LucideIcon
    /** La definición es el dato principal: base y bold, en una línea. */
    prominent?: boolean
    /** Segunda definición, pequeña, del mismo término. */
    hint?: React.ReactNode
}

function DefinitionItem({ label, icon, prominent = false, hint, className, children, ...props }: DefinitionItemProps) {
    const indent = icon ? "pl-5.5" : undefined
    return (
        <div data-slot="definition-item" className={cn("min-w-0", className)} {...props}>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                {icon && <Icon icon={icon} className="text-ink-4" />}
                {label}
            </dt>
            <dd className={cn(indent, prominent ? "mt-1.5 truncate text-base font-bold leading-snug text-ink" : "mt-0.5 text-sm text-ink")}>
                {children}
            </dd>
            {hint && <dd className={cn("mt-0.5 truncate text-xs text-ink-3", indent)}>{hint}</dd>}
        </div>
    )
}

export { DefinitionItem }
