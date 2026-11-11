import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * El único título de HitGuest. El NIVEL (`level`, h1–h4) es la jerarquía del
 * documento; el TAMAÑO (`size`) es cómo se ve. Van separados porque un `h3`
 * dentro de un diálogo no tiene por qué verse como un `h3` de página, pero los
 * dos salen de la misma escala cerrada:
 *
 * - page: el título de la pantalla (lo pone `PageHeader`).
 * - title: título de un bloque grande o de un paso del portal.
 * - section: título de una sección o tarjeta (igual que `SectionCard`).
 * - subsection: un grupo dentro de una sección.
 * - group: rótulo pequeño de un grupo de campos o datos.
 *
 * El color sale de `tone`: ink (dato), muted (rótulo pequeño, ink-3) o inverse
 * (sobre una superficie oscura). Desde la pantalla solo se pasa layout.
 */
const headingVariants = cva("font-sans font-bold text-balance", {
    variants: {
        size: {
            page: "text-2xl leading-tight tracking-tight sm:text-3xl",
            title: "text-xl leading-snug tracking-tight",
            section: "text-base leading-snug",
            subsection: "text-sm leading-snug",
            group: "text-xs leading-snug",
        },
        tone: {
            ink: "text-ink",
            muted: "text-ink-3",
            inverse: "text-white",
        },
    },
    defaultVariants: {
        tone: "ink",
    },
})

type HeadingLevel = 1 | 2 | 3 | 4
type HeadingSize = NonNullable<VariantProps<typeof headingVariants>["size"]>
type HeadingTone = NonNullable<VariantProps<typeof headingVariants>["tone"]>

/** Tamaño por omisión de cada nivel, para el caso común. */
const DEFAULT_SIZE: Record<HeadingLevel, HeadingSize> = {
    1: "page",
    2: "title",
    3: "section",
    4: "subsection",
}

interface HeadingProps extends React.ComponentProps<"h1"> {
    level: HeadingLevel
    size?: HeadingSize
    tone?: HeadingTone
}

function Heading({ level, size, tone = "ink", className, ...props }: HeadingProps) {
    const Tag = `h${level}` as const
    const resolved = size ?? DEFAULT_SIZE[level]
    return (
        <Tag
            data-slot="heading"
            data-size={resolved}
            className={cn(headingVariants({ size: resolved, tone }), className)}
            {...props}
        />
    )
}

export { Heading, headingVariants, type HeadingLevel, type HeadingSize, type HeadingTone }
