import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Estados (Fase 1, paso 4.2):
 * - hover y active: color explícito del token (`*-hover`), nunca opacidad ni
 *   escala/desplazamiento; active repite el hover para que en táctil se note.
 * - focus-visible: anillo de 3 px.
 * - disabled: legible (fondo sunk + tinta ink-3, 4.70:1) en vez de opacidad al
 *   50 %; `cursor-not-allowed`. Un botón nativo deshabilitado no dispara
 *   eventos; `aria-disabled` (p. ej. un enlace con asChild) lo bloquea el
 *   componente, no el CSS (ver `blockWhenUnavailable`).
 * - loading: ver `Button`. Se ve con su color (los estilos de no disponible
 *   excluyen `data-loading`).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:text-ink-3 disabled:shadow-none aria-disabled:not-data-loading:cursor-not-allowed aria-disabled:not-data-loading:text-ink-3 aria-disabled:not-data-loading:shadow-none data-loading:cursor-progress",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover disabled:bg-sunk aria-disabled:not-data-loading:bg-sunk",
        destructive:
          "bg-destructive text-white hover:bg-destructive-hover active:bg-destructive-hover focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 disabled:bg-sunk aria-disabled:not-data-loading:bg-sunk",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent dark:bg-input/30 dark:border-input dark:hover:bg-input/50 disabled:bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-hover disabled:bg-sunk aria-disabled:not-data-loading:bg-sunk",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent dark:hover:bg-accent/50 disabled:bg-transparent",
        link: "text-primary underline-offset-4 hover:underline disabled:no-underline aria-disabled:no-underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Bloquea el clic en la fase de CAPTURA, antes que cualquier otro manejador:
 * con `asChild`, Radix Slot ejecuta primero el `onClick` del hijo (el del
 * enlace, o el de NextLink), así que un guard en `onClick` llegaba tarde.
 * `stopPropagation` evita además que el clic llegue a una fila o tarjeta
 * clicable que contenga el botón.
 */
export function blockWhenUnavailable(event: React.SyntheticEvent, unavailable: boolean) {
  if (!unavailable) return
  event.preventDefault()
  event.stopPropagation()
}

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Acción en curso. El botón muestra un indicador y `loadingLabel`, queda
     * no disponible para la tecnología asistiva (`aria-disabled`, `aria-busy`)
     * y no vuelve a ejecutarse (tampoco envía el formulario ni dispara el clic
     * de un contenedor), pero NO usa `disabled`: conserva su color y el foco.
     * Representa el estado; la promesa la controla quien lo usa.
     */
    loading?: boolean
    /** Lo que dice mientras está en curso («Guardando…»). Con `asChild` se ignora. */
    loadingLabel?: string
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  loadingLabel,
  onClickCapture,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const ariaDisabled = props["aria-disabled"] === true || props["aria-disabled"] === "true"
  const unavailable = loading || ariaDisabled

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      aria-disabled={unavailable || undefined}
      onClickCapture={(event: React.MouseEvent<HTMLButtonElement>) => {
        blockWhenUnavailable(event, unavailable)
        onClickCapture?.(event)
      }}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {/* Slottable: con `asChild` el indicador entra en el enlace sin romperlo. */}
      <Slot.Slottable>{loading && loadingLabel && !asChild ? loadingLabel : children}</Slot.Slottable>
    </Comp>
  )
}

export { Button, buttonVariants }
