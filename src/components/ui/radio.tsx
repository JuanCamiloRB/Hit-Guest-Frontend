import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Radio nativo con el estilo del sistema: 16 px, `accent-primary` (el punto en
 * el morado de interacción), borde `input` y el foco sólido de las primitivas.
 * Nativo a propósito: conserva el grupo por `name` y las flechas del teclado.
 */
function Radio({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
    return (
        <input
            type="radio"
            data-slot="radio"
            className={cn(
                "size-4 shrink-0 cursor-pointer accent-primary outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    )
}

export { Radio }
