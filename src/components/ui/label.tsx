"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * - `default`: la etiqueta de un campo (14 px, medium, en línea con su ícono).
 * - `plain`: una etiqueta que ENVUELVE otra cosa (una casilla con un texto
 *   largo de consentimiento, una zona de carga): conserva la semántica y el
 *   estado deshabilitado, sin imponer tipografía ni layout — el texto largo no
 *   queda con `leading-none`.
 */
function Label({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { variant?: "default" | "plain" }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      data-variant={variant}
      className={cn(
        variant === "default" && "flex items-center gap-2 text-sm leading-none font-medium select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
