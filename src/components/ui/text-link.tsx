import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Un DATO que navega: el nombre del huésped en la tabla, el contacto en la
 * ficha, la reserva en el consumo. Se lee como dato (tinta) y se reconoce como
 * enlace al pasar o enfocar (morado y subrayado). Una ACCIÓN con forma de
 * enlace («Regístrate aquí», «Volver al inicio») no es esto: es
 * `Button variant="link" asChild`.
 */
function TextLink({
    className,
    tone = "ink",
    ...props
}: React.ComponentProps<typeof Link> & {
    /** `muted` para un dato secundario (ink-2). */
    tone?: "ink" | "muted"
}) {
    return (
        <Link
            data-slot="text-link"
            className={cn(
                "rounded-xs font-medium underline-offset-2 transition-colors hover:text-primary hover:underline",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                tone === "ink" ? "text-ink" : "text-ink-2",
                className,
            )}
            {...props}
        />
    )
}

export { TextLink }
