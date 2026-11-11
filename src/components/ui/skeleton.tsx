import { cn } from "@/lib/utils"

/**
 * Bloque gris con la forma de lo que viene. Decorativo: quien lo use anuncia la
 * espera (LoadingState o su propio `status`). Con «reducir movimiento» no pulsa.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
