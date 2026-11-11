import * as React from "react"
import type { LucideIcon, LucideProps } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Única forma de pintar un ícono fuera de components/ui (manual §6).
 *
 * - Tamaño: un paso de la escala, nunca un número ni una clase `h-*`/`w-*`.
 *   md (16 px) es el ícono de texto y de control; lg y xl acompañan títulos;
 *   2xl–4xl son ilustración (estado vacío, resultado de un paso del portal).
 * - Trazo: `regular` (2) siempre; `bold` (3) para el check de un paso hecho y
 *   `light` (1,5) para los íconos grandes de ilustración.
 * - Accesibilidad: decorativo por omisión (`aria-hidden`). Si el ícono es el
 *   único portador de significado, `label` lo convierte en una imagen con
 *   nombre.
 * - Color y posición vienen de `className` (tokens); el tamaño no.
 */
const ICON_SIZE = {
    xs: { className: "size-3", px: 12 },
    sm: { className: "size-3.5", px: 14 },
    md: { className: "size-4", px: 16 },
    lg: { className: "size-5", px: 20 },
    xl: { className: "size-6", px: 24 },
    "2xl": { className: "size-8", px: 32 },
    "3xl": { className: "size-10", px: 40 },
    "4xl": { className: "size-12", px: 48 },
} as const

const ICON_WEIGHT = { light: 1.5, regular: 2, bold: 3 } as const

type IconSize = keyof typeof ICON_SIZE
type IconWeight = keyof typeof ICON_WEIGHT

type IconProps = Omit<LucideProps, "size" | "width" | "height" | "strokeWidth" | "absoluteStrokeWidth" | "color"> & {
    icon: LucideIcon
    size?: IconSize
    weight?: IconWeight
    /** Nombre accesible cuando el ícono comunica algo que no dice el texto. */
    label?: string
}

function Icon({ icon: Glyph, size = "md", weight = "regular", label, className, ...props }: IconProps) {
    const step = ICON_SIZE[size]
    return (
        <Glyph
            aria-hidden={label ? undefined : true}
            {...props}
            {...(label ? { role: "img", "aria-label": label } : {})}
            data-slot="icon"
            data-size={size}
            size={step.px}
            strokeWidth={ICON_WEIGHT[weight]}
            className={cn(step.className, "shrink-0", className)}
        />
    )
}

export { Icon, ICON_SIZE }
export type { IconProps, IconSize, IconWeight }
