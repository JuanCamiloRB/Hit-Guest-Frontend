"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Switch } from "./switch"
import { Label } from "./label"
import { FieldError, FieldHint } from "./form"

/**
 * La fila «título + explicación + interruptor» (DS-8a, 2026-11-13). Estaba
 * armada a mano de cuatro formas (caja con borde, caja hundida, sin caja, y un
 * `span` junto al interruptor) y cinco de esas filas dejaban el interruptor
 * sin nombre accesible: un lector de pantalla decía solo «interruptor».
 *
 * - `label` es el nombre del interruptor: `Label htmlFor` → un clic en el
 *   texto también lo cambia.
 * - `description` y `error` quedan unidos con `aria-describedby`; con `error`
 *   el interruptor es `aria-invalid` (el 422 de un campo, como
 *   `parameters.credentials_scope`).
 * - `variant`: `boxed` (fila propia dentro de un diálogo o tarjeta) o `plain`
 *   (dentro de una fila o caja que ya existe).
 * - `tone`: una fila que se tiñe por su estado («desactivada», «la propiedad
 *   está inactiva»). Tiñe borde y fondo; la explicación sigue en ink-3, porque
 *   un estado no es un error (eso es `error`). Es estado de fila, no un aviso:
 *   para avisar, `FeedbackBanner`.
 * - `size="sm"`: la fila compacta de un encabezado («Heredar de la propiedad»).
 *
 * `className` solo lleva layout (ancho, márgenes); el interruptor no recibe
 * clases: su apariencia es de `Switch`.
 */
const switchFieldVariants = cva("group flex justify-between", {
    variants: {
        variant: {
            boxed: "rounded-lg border p-3",
            plain: "",
        },
        tone: {
            neutral: "",
            warning: "",
            danger: "",
        },
        size: {
            default: "gap-4",
            sm: "gap-2",
        },
    },
    compoundVariants: [
        { variant: "boxed", tone: "neutral", className: "border-rule bg-sunk/50" },
        { variant: "boxed", tone: "warning", className: "border-warning/30 bg-warning-sunk/30" },
        { variant: "boxed", tone: "danger", className: "border-danger/30 bg-danger-sunk/30" },
    ],
    defaultVariants: { variant: "boxed", tone: "neutral", size: "default" },
})

/** Lo que decide el nombre y la descripción del control; la pantalla no lo cambia. */
type ControlledAttribute = "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid" | "children" | "size" | "className"

type SwitchFieldProps = Omit<React.ComponentProps<typeof Switch>, ControlledAttribute> &
    VariantProps<typeof switchFieldVariants> & {
        /** El nombre del interruptor. Puede llevar un ícono delante. */
        label: React.ReactNode
        /** Qué pasa al encenderlo o apagarlo. */
        description?: React.ReactNode
        /** Error del backend sobre este control (422). Vacío no pinta nada. */
        error?: React.ReactNode
        /** Layout de la fila (ancho, márgenes). */
        className?: string
    }

function SwitchField({
    id: idProp,
    label,
    description,
    error,
    variant = "boxed",
    tone = "neutral",
    size = "default",
    disabled,
    className,
    ...props
}: SwitchFieldProps) {
    const generatedId = React.useId()
    const id = idProp ?? generatedId
    const descriptionId = `${id}-description`
    const errorId = `${id}-error`
    const hasError = error != null && error !== "" && error !== false
    const describedBy = [description ? descriptionId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined

    return (
        <div
            data-slot="switch-field"
            data-variant={variant}
            data-tone={tone}
            data-size={size}
            data-disabled={disabled ? "true" : undefined}
            className={cn(switchFieldVariants({ variant, tone, size }), description || hasError ? "items-start" : "items-center", className)}
        >
            <div className={cn("min-w-0", size === "sm" ? "" : "space-y-1")}>
                <Label htmlFor={id} className={size === "sm" ? "text-xs" : undefined}>
                    {label}
                </Label>
                {/* El tono tiñe la fila; la explicación sigue en ink-3. Solo `error` es un error. */}
                {description && (
                    <FieldHint id={descriptionId} compact>
                        {description}
                    </FieldHint>
                )}
                <FieldError id={errorId} compact>
                    {hasError ? error : null}
                </FieldError>
            </div>
            <Switch
                id={id}
                size={size === "sm" ? "sm" : "default"}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={hasError ? true : undefined}
                {...props}
            />
        </div>
    )
}

export { SwitchField, switchFieldVariants }
