"use client"

import * as React from "react"
import { MinusIcon, PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

/**
 * Entero con botones − y + (DS, 2026-11-16): «Huéspedes», noches, unidades.
 *
 * - Una sola caja con la apariencia de campo (borde input, hover habilitado y
 *   sin foco ni error, anillo con `focus-within`, inválido en danger,
 *   deshabilitado legible en sunk + ink-3), 40 px de alto.
 * - Dentro, dos `Button ghost` con nombre (`decrementLabel`/`incrementLabel`)
 *   que cambian de a `step` y se deshabilitan en los límites, y un `<input>`
 *   numérico centrado que también acepta escribir. `id`, `aria-invalid` y
 *   `aria-describedby` (los pone `FormControl`) van en ese input: la `Label
 *   htmlFor` lo nombra.
 * - Es un `spinbutton` (valor y límites anunciados); ↑ y ↓ cambian de a `step`.
 * - Al salir del input, el texto se redondea a entero y se acota a [min, max]
 *   (vacío o basura → `min`): `onValueChange` solo recibe números válidos.
 *
 * `className` solo lleva layout (ancho, márgenes).
 */
interface NumberStepperProps {
    /** El `<input>` del valor: react-hook-form lo enfoca en el primer error. */
    ref?: React.Ref<HTMLInputElement>
    /** Lo pone `FormControl`; va en el input para que la `Label` lo nombre. */
    id?: string
    value: number
    onValueChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    name?: string
    decrementLabel?: string
    incrementLabel?: string
    "aria-invalid"?: React.AriaAttributes["aria-invalid"]
    "aria-describedby"?: string
    /** Layout (ancho, márgenes). */
    className?: string
}

function NumberStepper({
    ref,
    id,
    value,
    onValueChange,
    min = 0,
    max,
    step = 1,
    disabled = false,
    name,
    decrementLabel = "Quitar uno",
    incrementLabel = "Agregar uno",
    className,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: NumberStepperProps) {
    // Lo que se está escribiendo; `null` = se muestra `value` tal cual.
    const [draft, setDraft] = React.useState<string | null>(null)
    const invalid = ariaInvalid === true || ariaInvalid === "true"

    const clamp = (candidate: number) => {
        const rounded = Math.round(candidate)
        const floor = Math.max(min, rounded)
        return max == null ? floor : Math.min(max, floor)
    }

    const commit = () => {
        if (draft === null) return
        const parsed = Number.parseInt(draft, 10)
        onValueChange(Number.isNaN(parsed) ? min : clamp(parsed))
        setDraft(null)
    }

    const atMin = value <= min
    const atMax = max != null && value >= max

    return (
        <div
            data-slot="number-stepper"
            data-invalid={invalid || undefined}
            data-disabled={disabled || undefined}
            className={cn(
                "border-input flex h-10 w-fit items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow,border-color]",
                "[&:not([data-invalid],[data-disabled]):not(:focus-within)]:hover:border-primary",
                "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                "data-[invalid]:border-danger data-[invalid]:ring-danger/20 dark:data-[invalid]:ring-danger/40",
                "data-[disabled]:bg-sunk data-[disabled]:text-ink-3 data-[disabled]:shadow-none",
                className
            )}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={decrementLabel}
                disabled={disabled || atMin}
                onClick={() => onValueChange(clamp(value - step))}
                className="mx-0.5"
            >
                <MinusIcon aria-hidden />
            </Button>
            <input
                ref={ref}
                id={id}
                name={name}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={draft ?? String(value)}
                disabled={disabled}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                // Spinbutton: el lector anuncia valor y límites; las flechas cambian de a `step`.
                role="spinbutton"
                aria-valuenow={value}
                aria-valuemin={min}
                aria-valuemax={max}
                onKeyDown={(event) => {
                    if (event.key === "Enter") commit()
                    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                        event.preventDefault()
                        setDraft(null)
                        onValueChange(clamp(value + (event.key === "ArrowUp" ? step : -step)))
                    }
                }}
                data-slot="number-stepper-input"
                className="text-ink h-full w-12 min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none disabled:cursor-not-allowed disabled:text-ink-3"
            />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={incrementLabel}
                disabled={disabled || atMax}
                onClick={() => onValueChange(clamp(value + step))}
                className="mx-0.5"
            >
                <PlusIcon aria-hidden />
            </Button>
        </div>
    )
}

export { NumberStepper }
export type { NumberStepperProps }
