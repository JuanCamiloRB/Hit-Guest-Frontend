import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Estados (Fase 1, paso 4.2):
 * - hover y active: color explícito del token (`*-hover`), nunca opacidad ni
 *   escala/desplazamiento; active repite el hover para que en táctil se note.
 * - focus-visible: `outline` sólido de 2 px separado 2 px (paso 5). El anillo
 *   anterior (ring-ring/50) daba 2,01:1 sobre blanco: no llegaba al 3:1 de un
 *   indicador (WCAG 1.4.11), y en el destructivo (/20) menos. El morado sólido
 *   da 4,42:1, la separación deja ver el fondo junto a los rellenos, y un
 *   `outline` sí se pinta en el modo de alto contraste (un ring es una sombra).
 *   `outline-solid` es obligatorio: `outline-none` deja `--tw-outline-style:
 *   none` y `outline-2` lo hereda, así que sin él no se pinta nada.
 * - disabled: legible (fondo sunk + tinta ink-3, 4.70:1) en vez de opacidad al
 *   50 %; `cursor-not-allowed`. Un botón nativo deshabilitado no dispara
 *   eventos; `aria-disabled` (p. ej. un enlace con asChild) lo bloquea el
 *   componente, no el CSS (ver `blockWhenUnavailable`).
 * - loading: ver `Button`. Se ve con su color (los estilos de no disponible
 *   excluyen `data-loading`).
 *
 * Densidades (paso 4.5):
 * - Predeterminada — formularios y acciones principales: `default`/`icon` 40 px,
 *   `lg`/`icon-lg` 44 px.
 * - Compacta — tablas y barras densas: `sm`/`icon-sm` 32 px, nunca menos.
 *   (Se retiraron `xs`/`icon-xs`, de 24 px: nadie los usaba.)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive disabled:cursor-not-allowed disabled:text-ink-3 disabled:shadow-none aria-disabled:not-data-loading:cursor-not-allowed aria-disabled:not-data-loading:text-ink-3 aria-disabled:not-data-loading:shadow-none data-loading:cursor-progress",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover disabled:bg-sunk aria-disabled:not-data-loading:bg-sunk",
        destructive:
          "bg-destructive text-white hover:bg-destructive-hover active:bg-destructive-hover disabled:bg-sunk aria-disabled:not-data-loading:bg-sunk",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent dark:bg-input/30 dark:border-input dark:hover:bg-input/50 disabled:bg-transparent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-hover disabled:bg-sunk aria-disabled:not-data-loading:bg-sunk",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent dark:hover:bg-accent/50 disabled:bg-transparent",
        link: "text-primary underline-offset-4 hover:underline disabled:no-underline aria-disabled:no-underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
        // Acción de texto dentro de una frase («Reenviar código»): sin alto ni
        // relleno, con `variant="link"`. El área de toque la da el texto.
        inline: "h-auto gap-1 p-0 has-[>svg]:px-0",
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
        // No disponible: se corta aquí y no llega a ningún manejador, tampoco al
        // onClickCapture de quien usa el botón.
        if (unavailable) return blockWhenUnavailable(event, true)
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
