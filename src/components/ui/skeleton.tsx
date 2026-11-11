import { cn } from "@/lib/utils"

/**
 * Bloque gris con la forma de lo que viene. Decorativo: quien lo use anuncia la
 * espera (LoadingState o su propio `status`). Con «reducir movimiento» no pulsa.
 */
function Skeleton({ className, inline = false, ...props }: React.ComponentProps<"div"> & {
  /** Dentro de texto o de un botón (donde un `div` no es HTML válido): `span` en línea. */
  inline?: boolean
}) {
  const classes = cn("bg-accent animate-pulse rounded-md motion-reduce:animate-none", inline && "inline-block align-middle", className)
  if (inline) return <span data-slot="skeleton" aria-hidden className={classes} {...(props as React.ComponentProps<"span">)} />
  return <div data-slot="skeleton" className={classes} {...props} />
}

export { Skeleton }
