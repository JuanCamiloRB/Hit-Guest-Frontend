import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * La superficie que comparten Card y SectionCard: fondo, tinta, borde, radio y
 * una sola elevación baja, todo con tokens. Neutral a propósito: sin
 * degradados, colores de estado, hover ni escala. El color semántico va en el
 * contenido, y una card clicable lleva dentro un enlace o botón real.
 */
const cardSurface = "bg-card text-ink rounded-xl border border-rule shadow-sm"

type SurfaceTag = "div" | "section" | "article" | "li" | "ul" | "aside" | "header" | "form"

interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  /** La etiqueta semántica (una tarjeta de una lista es `li`, una ficha `article`). */
  as?: SurfaceTag
  /**
   * Sin sombra: superficies que conviven en una cuadrícula densa (el Tablero) o
   * que ya van dentro de otra superficie, donde la elevación no ordena nada.
   */
  flat?: boolean
  /**
   * Un panel que flota sobre el contenido (la lista de un buscador propio): la
   * misma superficie que `Select` y `Popover`, radio `md` y sombra `md`.
   */
  floating?: boolean
}

/**
 * La superficie de tarjeta, sin estructura: fondo, borde, radio y elevación de
 * `cardSurface`, y el relleno y el layout los pone quien la usa. Es la tarjeta
 * de una pantalla que arma su propio interior (el paso del portal, la ficha de
 * una integración). Con encabezado y cuerpo estándar, `Card` o `SectionCard`.
 */
function Surface({ as: Tag = "div", flat = false, floating = false, className, ...props }: SurfaceProps) {
  return (
    <Tag
      data-slot="surface"
      data-flat={flat || undefined}
      data-floating={floating || undefined}
      className={cn(cardSurface, flat && "shadow-none", floating && "rounded-md shadow-md", className)}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  )
}

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(cardSurface, "flex flex-col gap-6 py-6", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      // ink-2 = «apoyo legible» (7.67:1); ink-3 no llega al 4.5:1 de AA.
      className={cn("text-ink-2 text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Surface,
  cardSurface,
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
