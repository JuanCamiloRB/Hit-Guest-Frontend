import * as React from "react"

import { cn } from "@/lib/utils"
import { cardSurface } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"

interface SectionCardProps extends Omit<React.ComponentProps<"section">, "title"> {
    title: string
    description?: string
    /** Filtros, búsqueda o botones de esta sección. En móvil bajan bajo el título. */
    actions?: React.ReactNode
    /** El cuerpo trae su propio espaciado (una tabla, un gráfico a sangre). */
    flush?: boolean
    /** Sin sombra, como `Surface flat`: dentro de otra superficie o en una cuadrícula densa. */
    flat?: boolean
    /**
     * Nivel del título en la página. Por defecto h3, como hasta ahora; al
     * migrar cada pantalla se ajusta a su jerarquía real.
     */
    headingLevel?: 2 | 3 | 4
}

/**
 * Una sección con título: lista, tabla o gráfico.
 *
 * Es un `<section>` nombrado por su título (`aria-labelledby`), con la misma
 * superficie que `Card` (`cardSurface`) pero sin su `gap-6`/`py-6`: entre el
 * encabezado y el cuerpo no queda espacio heredado (antes, 24 px extra). Un
 * solo padding para encabezado y cuerpo (`px-5`), y `flush` deja el cuerpo sin
 * ninguno.
 *
 * Sustituye a cuatro encabezados copiados a mano con una franja degradada y un
 * ícono de color: eso gastaba color en el contenedor en vez de en el dato. Aquí
 * el título lleva la jerarquía y la superficie queda en silencio.
 */
function SectionCard({
    title,
    description,
    actions,
    flush = false,
    flat = false,
    headingLevel = 3,
    className,
    children,
    ...props
}: SectionCardProps) {
    const titleId = React.useId()

    return (
        <section
            data-slot="section-card"
            data-flat={flat || undefined}
            aria-labelledby={titleId}
            className={cn(cardSurface, "flex flex-col gap-0 overflow-hidden", flat && "shadow-none", className)}
            {...props}
        >
            {/* El DOM sigue el orden visual: en móvil, título y después acciones. */}
            <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                    <Heading level={headingLevel} size="section" id={titleId} className="break-words">{title}</Heading>
                    {description && <p className="mt-0.5 text-xs text-ink-2">{description}</p>}
                </div>
                {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
            </div>

            <div className={cn(!flush && "p-5")}>{children}</div>
        </section>
    )
}

export { SectionCard }
