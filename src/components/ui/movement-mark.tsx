import { cva, type VariantProps } from "class-variance-authority"
import { LogIn, LogOut, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/**
 * La marca de un movimiento de la estadía: check-in (verde, flecha que entra)
 * o checkout (naranja, flecha que sale). Cuadro relleno con el ícono en
 * blanco, la misma forma en la leyenda, en la barra de ocupación y en la
 * grilla del mes: el movimiento se reconoce por el ícono además del color.
 *
 * - `bordered`: borde blanco de 2 px para separarla de una superficie de color
 *   (la barra morada de la estadía).
 * - `label`: la marca dice algo por sí sola (`role="img"`). Sin él es
 *   decorativa: el texto de al lado o el nombre del control lo dicen.
 *
 * Colores de estado a propósito: check-in = `success`, checkout = `warning`,
 * los mismos del calendario anterior. Blanco sobre cualquiera de los dos: 5.3:1.
 */
const MOVEMENT: Record<"checkin" | "checkout", { icon: LucideIcon; fill: string; label: string }> = {
    checkin: { icon: LogIn, fill: "bg-success", label: "Check-in" },
    checkout: { icon: LogOut, fill: "bg-warning", label: "Checkout" },
}

const movementMarkVariants = cva("inline-flex shrink-0 items-center justify-center rounded-md text-white", {
    variants: {
        size: {
            sm: "size-5",
            md: "size-6",
        },
        bordered: {
            true: "border-2 border-white shadow-xs",
            false: "",
        },
    },
    defaultVariants: { size: "md", bordered: false },
})

type MovementKind = keyof typeof MOVEMENT

interface MovementMarkProps extends VariantProps<typeof movementMarkVariants> {
    kind: MovementKind
    /** Nombre accesible cuando la marca va sola; sin él, decorativa. */
    label?: string
    className?: string
}

function MovementMark({ kind, size = "md", bordered = false, label, className }: MovementMarkProps) {
    const movement = MOVEMENT[kind]
    return (
        <span
            data-slot="movement-mark"
            data-kind={kind}
            className={cn(movementMarkVariants({ size, bordered }), movement.fill, className)}
            {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
        >
            <Icon icon={movement.icon} size="xs" weight="bold" />
        </span>
    )
}

/** La palabra de cada movimiento («Check-in», «Checkout»): la misma en la leyenda y en el detalle. */
const MOVEMENT_LABEL: Record<MovementKind, string> = { checkin: MOVEMENT.checkin.label, checkout: MOVEMENT.checkout.label }

export { MovementMark, MOVEMENT_LABEL, movementMarkVariants, type MovementKind }
