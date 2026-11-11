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
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeTone }
