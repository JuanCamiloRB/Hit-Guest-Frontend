import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Estados de un campo de texto (Fase 1, paso 4.3), compartidos por Input y
 * Textarea:
 * - texto ink; placeholder ink-3 (5.23:1 sobre blanco, 4.70 sobre sunk).
 * - borde: --input, el azul de marca (4.47:1 sobre card).
 * - hover: borde primary (5.44:1), solo si se puede escribir (no deshabilitado, no
 *   readonly, no inválido: el rojo del error manda) y SIN foco: el borde de
 *   foco gana siempre. Va con `hover:` de Tailwind, que solo aplica con
 *   puntero (`@media (hover:hover)`): en táctil el hover no se queda pegado.
 * - focus-visible: anillo de 3 px (sin cambios).
 * - inválido (`aria-invalid`, lo pone FormControl): borde y anillo destructivos.
 * - deshabilitado: legible (sunk + ink-3) en vez de opacidad, cursor not-allowed.
 * - readonly: fondo sunk, texto ink legible, sigue enfocable y seleccionable.
 */
export const fieldStates = [
  "text-ink placeholder:text-ink-3 border-input",
  "[&:not([readonly],[aria-invalid=true],:focus):enabled]:hover:border-primary",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger",
  "disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-3 disabled:shadow-none",
  "[&[readonly]]:bg-sunk [&[readonly]]:shadow-none",
].join(" ")

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-ink selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm",
        fieldStates,
        className
      )}
      {...props}
    />
  )
}

export { Input }
