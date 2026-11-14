"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "./checkbox"
import { Label } from "./label"
import { Surface } from "./card"

interface CheckboxFieldProps
    extends Omit<React.ComponentProps<typeof Checkbox>, "id" | "children" | "className" | "ref"> {
    id?: string
    label: React.ReactNode
    /** Enlace o ayuda relacionada, fuera de la etiqueta para no anidar controles. */
    action?: React.ReactNode
    className?: string
    checkboxClassName?: string
}

/**
 * Fila estándar de consentimiento. Radix Checkbox renderiza un botón: envolverlo
 * en un `<label>` no activa de forma fiable el control en el navegador y además
 * vuelve inválido cualquier enlace dentro del texto. Esta primitiva conecta un
 * `Label htmlFor` explícito y mantiene la acción relacionada fuera de la etiqueta.
 */
function CheckboxField({
    id,
    label,
    action,
    className,
    checkboxClassName,
    disabled,
    ...props
}: CheckboxFieldProps) {
    const generatedId = React.useId()
    const controlId = id ?? `${generatedId}-checkbox`
    const controlRef = React.useRef<HTMLButtonElement>(null)

    return (
        <Surface
            tone="sunk"
            interactive={!disabled}
            data-slot="checkbox-field"
            className={cn("flex items-start gap-3 p-3", disabled && "cursor-not-allowed", className)}
        >
            <Checkbox
                ref={controlRef}
                id={controlId}
                disabled={disabled}
                className={cn("mt-0.5 size-5", checkboxClassName)}
                {...props}
            />
            <div className={cn("min-w-0 flex-1 text-sm font-medium", disabled ? "text-ink-3" : "text-ink-2")}>
                <Label
                    htmlFor={controlId}
                    variant="plain"
                    // `block`: toda la fila de texto activa la casilla, no solo los glifos.
                    className={cn("block cursor-pointer select-none", disabled && "cursor-not-allowed")}
                    onClick={(event) => {
                        if (event.target === controlRef.current) return
                        // Un Radix Checkbox es un <button>, no un <input>. Chrome
                        // no activa de forma consistente ese botón con el default
                        // action de <label>; lo hacemos explícito y cancelamos el
                        // default para garantizar exactamente un cambio.
                        event.preventDefault()
                        if (!disabled) controlRef.current?.click()
                    }}
                >
                    {label}
                </Label>
                {action && <div className="mt-1">{action}</div>}
            </div>
        </Surface>
    )
}

export { CheckboxField }
