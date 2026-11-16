import * as React from "react"

import { cn } from "@/lib/utils"
import { bottomBarSurface } from "./bottom-bar"

interface FormActionBarProps extends React.ComponentProps<"div"> {
    /** El texto de apoyo a la izquierda («* Campos obligatorios», «Cambios sin guardar»). */
    status?: React.ReactNode
    /** Las acciones (`Button`) a la derecha. */
    children: React.ReactNode
}

/**
 * La barra de acciones de un formulario largo del panel: pegajosa al pie de su
 * contenedor (la `Page`), con la misma superficie de vidrio y divisor que la
 * `BottomBar` del portal (`bottomBarSurface`) pero su propia geometría: ocupa
 * el ancho del contenedor, no la ventana, y va en `z-20` (sobre el contenido,
 * bajo diálogos y menús).
 *
 * El formulario reserva su propio espacio al pie (`pb-24`) para que el último
 * campo no quede debajo, igual que las pantallas del portal con `BottomBar`.
 * Sin `env(safe-area-inset-bottom)`: la app no fija `viewport-fit=cover`.
 *
 * En móvil las acciones van arriba y el texto de apoyo debajo
 * (`flex-col-reverse`); desde `sm`, texto a la izquierda y acciones a la
 * derecha. `className` es solo layout (márgenes negativos para pegarla al borde
 * del contenedor, por ejemplo).
 */
function FormActionBar({ status, children, className, ...props }: FormActionBarProps) {
    const hasStatus = status != null && status !== ""
    return (
        <div
            role="region"
            aria-label="Acciones del formulario"
            data-slot="form-action-bar"
            className={cn(
                "sticky bottom-0 z-20 flex w-full flex-col-reverse gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6",
                bottomBarSurface,
                className,
            )}
            {...props}
        >
            {hasStatus && (
                <p data-slot="form-action-bar-status" className="text-xs text-ink-3">
                    {status}
                </p>
            )}
            <div data-slot="form-action-bar-actions" className="flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
                {children}
            </div>
        </div>
    )
}

export { FormActionBar }
export type { FormActionBarProps }
