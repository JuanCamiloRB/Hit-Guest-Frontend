import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Rótulo de GRUPO en navegación («Sistema» en el menú, «Configuración» sobre
 * sus secciones). Es el único lugar donde el sistema usa mayúsculas: el resto
 * de la interfaz va en caso de oración (datos, estados, encabezados, botones).
 * Una o dos palabras; nunca para un dato ni una acción.
 */
function Overline({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="overline"
            className={cn("text-xs font-semibold uppercase tracking-wider text-ink-3", className)}
            {...props}
        />
    )
}

export { Overline }
