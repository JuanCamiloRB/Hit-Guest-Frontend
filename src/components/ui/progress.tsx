"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Barra de progreso (DS-8b, 2026-11-13). Había cuatro a mano, con tres altos
 * y sin semántica: pasos del check-in, huéspedes completados, avance de la
 * verificación y ejecuciones por nodo en el Tablero.
 *
 * - Pista `sunk`, avance `primary` (4,89:1 sobre la pista) o `success` cuando
 *   lo que mide terminó bien.
 * - `size`: `xs` 4 px (pasos de un flujo), `sm` 6 px (filas de datos), `md`
 *   8 px (progreso protagonista de una pantalla).
 * - `label` es obligatorio: es el nombre de la barra para un lector de
 *   pantalla; Radix agrega `role="progressbar"` y los `aria-value*`.
 * - `value` se recorta a `[0, max]`; con avance > 0 la barra mide al menos
 *   2 px para que un valor chico no desaparezca. Un `max` inválido (0 o
 *   negativo: «1 de 0 completados») no es un porcentaje: la barra queda vacía.
 */
const progressVariants = cva("relative w-full overflow-hidden rounded-full bg-sunk", {
    variants: {
        size: {
            xs: "h-1",
            sm: "h-1.5",
            md: "h-2",
        },
    },
    defaultVariants: { size: "sm" },
})

const INDICATOR_TONE = {
    primary: "bg-primary",
    success: "bg-success",
} as const

type ProgressProps = Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, "children" | "value" | "max" | "aria-label"> &
    VariantProps<typeof progressVariants> & {
        /** Avance, en las unidades de `max`. */
        value: number
        /** Total; por omisión 100 (porcentaje). */
        max?: number
        /** Qué mide la barra; lo oye un lector de pantalla. */
        label: string
        tone?: keyof typeof INDICATOR_TONE
    }

function Progress({ value, max = 100, label, tone = "primary", size, className, ...props }: ProgressProps) {
    const validMax = Number.isFinite(max) && max > 0
    const safeMax = validMax ? max : 100
    const clamped = validMax ? Math.min(safeMax, Math.max(0, Number.isFinite(value) ? value : 0)) : 0
    const percent = (clamped / safeMax) * 100

    return (
        <ProgressPrimitive.Root
            {...props}
            data-slot="progress"
            data-tone={tone}
            value={clamped}
            max={safeMax}
            aria-label={label}
            className={cn(progressVariants({ size }), className)}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                className={cn("h-full rounded-full transition-all duration-500 ease-out", INDICATOR_TONE[tone], clamped > 0 && "min-w-0.5")}
                style={{ width: `${percent}%` }}
            />
        </ProgressPrimitive.Root>
    )
}

export { Progress, progressVariants }
