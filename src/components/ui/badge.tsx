import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Etiqueta corta que CLASIFICA algo («Principal», «Personalizada», «Token»,
 * el tipo de una propiedad). No es un estado: un estado lleva punto y va con
 * `StatusPill`. Misma forma que StatusPill (radio md, xs semibold) para que
 * ambas se lean como una familia; el color sale de `tone`, nunca de clases.
 *
 * - neutral: dato sin carga («Token», «Miembro»).
 * - accent: lo propio de HitGuest o lo personalizado («Personalizada»).
 * - success / warning / danger / info: el mismo significado que en los avisos.
 * - surface: sobre una foto o un mapa, con fondo propio para leerse.
 * - integration: con qué PMS o canal está vinculado algo (Alojamientos:
 *   «KunasPMS»); el azul secundario al 10 % con texto secondary-hover.
 * - data: una cifra que importa (el precio por noche): el morado claro de la
 *   celda de dato (`StatusTile data`) con borde. Dentro de una fila de tabla
 *   (`group/row` de TableRow), al pasar por la fila se llena de primary-hover
 *   con texto blanco: la cifra se lee como el dato de esa fila.
 *
 * Tamaño: `sm` (por omisión) en texto y listas; `md` dentro de una celda de
 * tabla cómoda (`DataTable density="comfortable"`), al alto de la celda de dato.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold [&>svg]:pointer-events-none",
  {
    variants: {
      tone: {
        neutral: "bg-neutral-sunk text-ink-2",
        accent: "bg-primary/10 text-primary",
        success: "bg-success-sunk text-success",
        warning: "bg-warning-sunk text-warning",
        danger: "bg-danger-sunk text-danger",
        info: "bg-info-sunk text-info",
        surface: "bg-card text-ink shadow-xs",
        integration: "bg-secondary/10 text-secondary-hover",
        data: "border border-primary/30 bg-primary/10 text-primary-hover transition-colors group-hover/row:border-primary-hover group-hover/row:bg-primary-hover group-hover/row:text-primary-foreground",
      },
      size: {
        sm: "",
        md: "min-h-7 gap-1.5 px-2.5 py-1",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "sm",
    },
  }
)

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

function Badge({
  className,
  tone = "neutral",
  size = "sm",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeVariants({ tone, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeTone }
