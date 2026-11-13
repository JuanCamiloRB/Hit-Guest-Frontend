import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * La cifra protagonista (DS-8c, 2026-11-13): un saldo, un importe, un conteo,
 * un código de acceso. El contrato (§3) la pide en Gabarito como a los
 * títulos; había 8 a mano en 5 variantes y solo 2 en Gabarito.
 *
 * - size: `md` (lg) para una cifra dentro de una frase, `lg` (2xl) para la
 *   cifra de una tarjeta, `xl` (3xl) para la protagonista de una pantalla.
 * - tone: `ink` (dato), `absent` (ink-4: el «—» de un dato que no existe,
 *   nunca texto informativo), `warning`/`danger` para un saldo bajo o agotado.
 * - kind: `number` (tracking apretado, dígitos tabulares) o `code` (tracking
 *   abierto: un código se lee dígito a dígito, §3 lo permite).
 *
 * Es un `span` (o `p`/`dd` con `as`); el rótulo que dice qué es la cifra va al
 * lado, en texto normal. Desde la pantalla solo layout.
 */
const figureVariants = cva("font-sans font-bold leading-tight tabular-nums", {
    variants: {
        size: {
            md: "text-lg",
            lg: "text-2xl",
            xl: "text-3xl",
        },
        tone: {
            ink: "text-ink",
            absent: "text-ink-4",
            warning: "text-warning",
            danger: "text-danger",
        },
        kind: {
            number: "tracking-tight",
            code: "tracking-widest",
        },
    },
    defaultVariants: { size: "lg", tone: "ink", kind: "number" },
})

type FigureTag = "span" | "p" | "dd"

type FigureProps = React.HTMLAttributes<HTMLElement> &
    VariantProps<typeof figureVariants> & {
        as?: FigureTag
    }

function Figure({ as: Tag = "span", size, tone, kind, className, ...props }: FigureProps) {
    return (
        <Tag
            data-slot="figure"
            data-size={size ?? "lg"}
            data-tone={tone ?? "ink"}
            data-kind={kind ?? "number"}
            className={cn(figureVariants({ size, tone, kind }), className)}
            {...props}
        />
    )
}

export { Figure, figureVariants }
