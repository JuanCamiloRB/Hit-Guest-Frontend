import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Un control pulsable SIN apariencia propia: para lo que no es un botón
 * (tarjetas seleccionables, ítems de menú, encabezados que ordenan, filas).
 * Lo que sí impone es el comportamiento del sistema:
 *  - `type="button"` por defecto (no envía un formulario por accidente);
 *  - el mismo foco sólido que Button (outline 2 px separado, 3:1);
 *  - cursor y eventos de deshabilitado.
 * La forma la ponen tokens en `className`. Para una acción con aspecto de
 * botón o de enlace, `Button` (variantes `default`…`link`).
 */
function UnstyledButton({ className, type = "button", ...props }: React.ComponentProps<"button">) {
    return (
        <button
            type={type}
            data-slot="unstyled-button"
            className={cn(
                "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
                className,
            )}
            {...props}
        />
    )
}

export { UnstyledButton }
