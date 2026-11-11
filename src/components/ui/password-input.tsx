"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Icon } from "./icon"
import { Input } from "./input"

/**
 * Campo de contraseña o secreto con el botón de mostrar/ocultar. Estaba copiado
 * tres veces (Kunas ×2, parámetros de automatización), y en una el botón no
 * tenía nombre accesible. Aquí el botón es un `Button` con nombre que cambia y
 * `aria-pressed`; el campo es el `Input` de siempre (alto, borde y foco).
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = React.useState(false)
    return (
        <div data-slot="password-input" className="relative">
            <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setVisible((v) => !v)}
                aria-pressed={visible}
                aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                disabled={props.disabled}
            >
                <Icon icon={visible ? EyeOff : Eye} />
            </Button>
        </div>
    )
}

export { PasswordInput }
