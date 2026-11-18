"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "./checkbox"
import { Label } from "./label"
import { Surface } from "./card"

interface CheckboxCardProps {
    id?: string
    label: React.ReactNode
    /** La aclaración bajo el título; queda en `aria-describedby`, no en el nombre. */
    description?: React.ReactNode
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    /** Para formularios planos: Radix emite un input oculto con `name`/`value`. */
    name?: string
    value?: string
    /** Solo layout (ancho, columna de la grilla). */
    className?: string
}

/**
 * La casilla cuya tarjeta entera es la etiqueta (una grilla de comodidades,
 * de canales, de documentos a pedir). Marcada, es una `Surface tone="selected"`
 * (borde `primary/30` + tinte `primary/5`); sin marcar, la superficie base con
 * el hover de `interactive`.
 *
 * Misma regla que `CheckboxField`: el Radix Checkbox es un `<button>`, así que
 * la `Label htmlFor` es su HERMANA, nunca lo envuelve (un botón dentro de un
 * label se activa dos veces o ninguna según el navegador). El clic en cualquier
 * punto de la tarjeta que no sea el control lo reenvía al control UNA vez: se
 * cancela la activación implícita del label y se hace explícita.
 */
function CheckboxCard({
    id,
    label,
    description,
    checked,
    onCheckedChange,
    disabled = false,
    name,
    value,
    className,
}: CheckboxCardProps) {
    const generatedId = React.useId()
    const controlId = id ?? `${generatedId}-checkbox`
    const descriptionId = `${controlId}-description`
    const controlRef = React.useRef<HTMLButtonElement>(null)

    return (
        <Surface
            tone={checked ? "selected" : "default"}
            interactive={!disabled}
            flat
            data-slot="checkbox-card"
            data-checked={checked || undefined}
            data-disabled={disabled || undefined}
            className={cn(
                "flex min-h-11 items-start gap-3 rounded-lg px-3 py-2.5 select-none",
                disabled ? "cursor-not-allowed bg-sunk text-ink-3" : "cursor-pointer",
                className,
            )}
            onClick={(event) => {
                const control = controlRef.current
                const target = event.target as Node
                if (!control || control.contains(target)) return
                // Dentro de un <form>, Radix emite un <input type="checkbox"> oculto
                // (hermano del botón) y le despacha un `click` propio en cada cambio
                // para que el formulario se entere. Ese clic sube hasta aquí y NO es
                // del usuario: reenviarlo al control volvería a cambiar el valor y
                // dispararía otro clic oculto, sin fin (React #185).
                if (target instanceof HTMLInputElement) return
                // El clic en el texto o en el relleno de la tarjeta: se cancela el
                // default del <label> (que en Chrome no activa un botón de forma
                // consistente) y se pulsa el control una sola vez.
                event.preventDefault()
                if (!disabled) control.click()
            }}
        >
            <Checkbox
                ref={controlRef}
                id={controlId}
                name={name}
                value={value}
                checked={checked}
                onCheckedChange={(next) => onCheckedChange(next === true)}
                disabled={disabled}
                aria-describedby={description ? descriptionId : undefined}
                className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
                <Label
                    htmlFor={controlId}
                    variant="plain"
                    className={cn("block text-sm font-medium", disabled ? "cursor-not-allowed text-ink-3" : "cursor-pointer text-ink")}
                >
                    {label}
                </Label>
                {description && (
                    <p id={descriptionId} data-slot="checkbox-card-description" className="mt-0.5 text-xs text-ink-3">
                        {description}
                    </p>
                )}
            </div>
        </Surface>
    )
}

export { CheckboxCard }
export type { CheckboxCardProps }
