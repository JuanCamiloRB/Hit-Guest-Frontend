import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/**
 * Una nota (DS-8d, 2026-11-13): la aclaración breve que acompaña a un campo,
 * un paso o una lista («Guarda la unidad para poder personalizar el texto»,
 * los consejos para la selfie). Había 23 cajas a mano en 14 combinaciones de
 * clases, y 7 más en tinte morado.
 *
 * No es un aviso: no anuncia nada, no tiene estado ni acción. Lo que cambia o
 * pide atención es `FeedbackBanner`; la caja que agrupa contenido es `Surface
 * tone="sunk"`.
 *
 * - tone: `neutral` (hundida, `sunk/50`) o `accent` (tinte `primary/5` con
 *   borde `primary/20`: lo destacado, el siguiente paso, lo que conviene leer).
 * - density: `compact` (una o dos líneas, xs) o `default` (un bloque con
 *   varias líneas o una lista, sm).
 * - icon: decorativo, delante del texto, en `ink-4` (neutral) o `primary`
 *   (accent). El texto dice lo que el ícono sugiere.
 * - as: `p` por omisión; `div` para varios párrafos, `ul` para una lista.
 */
const noteVariants = cva("rounded-lg", {
    variants: {
        tone: {
            neutral: "bg-sunk/50 text-ink-2",
            accent: "border border-primary/20 bg-primary/5 text-ink-2",
        },
        density: {
            compact: "px-3 py-2 text-xs",
            default: "p-4 text-sm",
        },
    },
    defaultVariants: { tone: "neutral", density: "compact" },
})

const ICON_INK = { neutral: "text-ink-4", accent: "text-primary" } as const

/**
 * El ícono solo cabe en `p` (texto en línea) o `div` (bloque): una lista (`ul`,
 * `li`) no puede llevar un hijo que no sea `li`. Con `as="p"`, el contenido
 * debe ser texto en línea (un `<p>` no admite bloques).
 */
type NoteProps = React.HTMLAttributes<HTMLElement> &
    VariantProps<typeof noteVariants> &
    ({ as?: "p" | "div"; icon?: LucideIcon } | { as: "ul" | "li"; icon?: never })

function Note({ as: Tag = "p", tone = "neutral", density = "compact", icon, className, children, ...props }: NoteProps) {
    // Con ícono, el texto va en su propio nodo junto a él: `span` dentro de un
    // párrafo, `div` cuando la nota es un bloque (un párrafo no puede ir en un span).
    const Body = Tag === "p" ? "span" : "div"
    return (
        <Tag
            data-slot="note"
            data-tone={tone}
            data-density={density}
            className={cn(noteVariants({ tone, density }), icon && "flex items-start gap-2", className)}
            {...props}
        >
            {icon && <Icon icon={icon} size={density === "compact" ? "sm" : "md"} className={cn("mt-0.5 shrink-0", ICON_INK[tone ?? "neutral"])} />}
            {icon ? <Body className="min-w-0 flex-1">{children}</Body> : children}
        </Tag>
    )
}

export { Note, noteVariants }
