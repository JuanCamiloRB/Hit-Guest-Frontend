"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/**
 * Un bloque plegable con su título (DS-8b, 2026-11-13). Reemplaza los
 * `<details>/<summary>` armados a mano (siete preguntas de la garantía con el
 * marcador nativo escondido, y una «Información técnica» plana).
 *
 * - `row`: una fila de una lista de preguntas (título semibold, flecha a la
 *   derecha, cuerpo en ink-3). La lista pone el divisor (`divide-y divide-rule`).
 * - `inline`: un detalle secundario dentro de un aviso o un texto (xs, ink-3).
 *
 * El disparador es un botón real (Radix Collapsible): teclado, foco visible y
 * `aria-expanded`/`aria-controls` sin trabajo de la pantalla. Cerrado, el
 * contenido no está en el DOM: una prueba que lo necesite abre primero.
 */
type DisclosureProps = Omit<React.ComponentProps<typeof CollapsiblePrimitive.Root>, "children"> & {
    title: React.ReactNode
    variant?: "row" | "inline"
    children: React.ReactNode
}

function Disclosure({ title, variant = "row", className, children, ...props }: DisclosureProps) {
    return (
        <CollapsiblePrimitive.Root
            data-slot="disclosure"
            data-variant={variant}
            className={cn(variant === "row" && "py-1", className)}
            {...props}
        >
            <CollapsiblePrimitive.Trigger
                data-slot="disclosure-trigger"
                className={cn(
                    // Foco como Button (paso 5): outline sólido de 2 px separado 2 px, 4,42:1.
                    // El anillo ring/50 daba 2,01:1 y no llega al 3:1 de WCAG 1.4.11.
                    "group/disclosure flex w-full cursor-pointer items-center gap-2 rounded-xs text-left outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    variant === "row"
                        ? "justify-between py-3 text-sm font-semibold text-ink"
                        : "text-xs font-medium text-ink-3 transition-colors hover:text-ink-2",
                )}
            >
                <span>{title}</span>
                <Icon
                    icon={ChevronDown}
                    size={variant === "row" ? "sm" : "xs"}
                    className="shrink-0 text-ink-4 transition-transform group-data-[state=open]/disclosure:rotate-180"
                />
            </CollapsiblePrimitive.Trigger>
            <CollapsiblePrimitive.Content
                data-slot="disclosure-content"
                className={variant === "row" ? "pb-3 text-sm leading-relaxed text-ink-3" : "mt-1 text-xs text-ink-3"}
            >
                {children}
            </CollapsiblePrimitive.Content>
        </CollapsiblePrimitive.Root>
    )
}

export { Disclosure }
