import * as React from "react"
import { Lock, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Surface } from "./card"
import { Icon } from "./icon"

/**
 * Un dato que se muestra como campo pero no se edita (DS-8e, 2026-11-13): el
 * tipo y número de documento al retomar un check-in (cambiarlos crearía otro
 * huésped), el correo de la cuenta recién creada. Vivía en `checkin/` y
 * `RegisterForm` lo dibujaba a mano con otras clases.
 *
 * - Caja `Surface tone="sunk"` (la superficie de lo deshabilitado), con el
 *   valor al tamaño de un `Input` (16 px, 14 px desde `md`) y, si `locked`, un
 *   candado decorativo.
 * - Semántica: un término y su definición (`dl`). No es un `textbox`: un
 *   control de solo lectura promete foco y edición de teclado que un `div` no
 *   da, y quien navega por formulario lo salteaba. El lector lee «Número de
 *   documento, 1020304050» en orden, y la pista va como segunda definición.
 * - Sin valor muestra «—» (ausencia, §2).
 */
interface ReadOnlyFieldProps extends Omit<React.ComponentProps<"dl">, "children"> {
    label: string
    value: string | null | undefined
    /** Por qué no se puede editar, o qué significa el dato. */
    hint?: string
    /** Muestra el candado. `false` para un dato que simplemente se informa. */
    locked?: boolean
    icon?: LucideIcon
}

function ReadOnlyField({ label, value, hint, locked = true, icon = Lock, className, ...props }: ReadOnlyFieldProps) {
    return (
        <dl data-slot="read-only-field" className={cn("space-y-1.5", className)} {...props}>
            {/* El rótulo con la tipografía de `Label` (14 px, medium): se ve como el de un campo. */}
            <dt className="text-sm leading-none font-medium text-ink">{label}</dt>
            <dd>
                <Surface
                    tone="sunk"
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-base font-medium text-ink-2 md:text-sm"
                >
                    {/* Un dato de solo lectura no puede quedar oculto: correos y
                        documentos largos se parten dentro de la caja en vez de
                        truncarse sin una forma de recuperar el valor completo. */}
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{value || "—"}</span>
                    {locked && <Icon icon={icon} size="sm" className="shrink-0 text-ink-3" />}
                </Surface>
            </dd>
            {hint && <dd className="text-xs text-ink-3">{hint}</dd>}
        </dl>
    )
}

export { ReadOnlyField }
