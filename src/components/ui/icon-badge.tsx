import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon, type IconSize } from "./icon"

/**
 * Un ícono dentro de una forma con fondo: el círculo que encabeza una pantalla
 * de resultado («Pago exitoso», «Documento no disponible») o el recuadro que
 * identifica una categoría (una integración). Estaba armado a mano 21 veces
 * con cinco tamaños, bordes al /20 y radios distintos.
 *
 * - tone: el fondo es el `*-sunk` del tono y el ícono su tinta; `neutral` en
 *   sunk/ink-2 y `primary` en primary/10. Sin borde: el color ya separa.
 * - size: sm 32 px, md 44 px, lg 64 px, xl 96 px; el ícono escala con él.
 * - shape: `circle` para estados, `square` (radio de la escala) para categorías.
 *
 * Decorativo: el texto que lo acompaña dice lo que significa.
 */
const iconBadgeVariants = cva("inline-flex shrink-0 items-center justify-center", {
    variants: {
        tone: {
            neutral: "bg-sunk text-ink-2",
            primary: "bg-primary/10 text-primary",
            success: "bg-success-sunk text-success",
            warning: "bg-warning-sunk text-warning",
            danger: "bg-danger-sunk text-danger",
            info: "bg-info-sunk text-info",
        },
        size: {
            sm: "size-8",
            md: "size-11",
            lg: "size-16",
            xl: "size-24",
        },
        shape: {
            circle: "rounded-full",
            square: "",
        },
    },
    compoundVariants: [
        { shape: "square", size: "sm", className: "rounded-lg" },
        { shape: "square", size: ["md", "lg", "xl"], className: "rounded-xl" },
    ],
    defaultVariants: { tone: "neutral", size: "md", shape: "circle" },
})

const GLYPH: Record<NonNullable<VariantProps<typeof iconBadgeVariants>["size"]>, IconSize> = {
    sm: "md",
    md: "lg",
    lg: "2xl",
    xl: "3xl",
}

type IconBadgeProps = Omit<React.ComponentProps<"span">, "children"> &
    VariantProps<typeof iconBadgeVariants> & {
        /** El ícono. Para un contenido propio (un Spinner, un ícono que cambia), `children`. */
        icon?: LucideIcon
        children?: React.ReactNode
    }

function IconBadge({ icon, tone = "neutral", size = "md", shape = "circle", className, children, ...props }: IconBadgeProps) {
    return (
        <span
            data-slot="icon-badge"
            data-tone={tone}
            aria-hidden={children ? undefined : true}
            className={cn(iconBadgeVariants({ tone, size, shape }), className)}
            {...props}
        >
            {icon ? <Icon icon={icon} size={GLYPH[size ?? "md"]} /> : children}
        </span>
    )
}

/** El tamaño de ícono que corresponde a cada tamaño de IconBadge, para `children`. */
const iconBadgeGlyph = GLYPH

export { IconBadge, iconBadgeVariants, iconBadgeGlyph }
