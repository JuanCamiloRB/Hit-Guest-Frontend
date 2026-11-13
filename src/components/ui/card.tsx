import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * La superficie que comparten Card y SectionCard: fondo, tinta, borde, radio y
 * una sola elevación baja, todo con tokens. Neutral a propósito: sin
 * degradados, colores de estado ni escala. El color semántico va en el
 * contenido, y una card clicable lleva dentro un enlace o botón real.
 *
 * Variantes (DS-8c, 2026-11-13; antes 14 tarjetas las armaban con clases):
 * - `tone="inverse"`: la tarjeta sobre `primary` con texto blanco («Acciones
 *   rápidas»); adentro, `Heading tone="inverse"` y `Button variant="inverse"`.
 * - `tone="warning"` / `"danger"`: una tarjeta que se tiñe por su estado (el
 *   borde al /30, como una fila teñida: es estado, no un aviso; el texto que
 *   lo dice va adentro). `tone="sunk"`: la superficie hundida (un panel dentro de una tarjeta, un documento
 *   eliminado): superficie `sunk`, sin sombra, sin opacidad.
 * - `interactive`: una tarjeta que lleva a algo o se elige; al pasar, el borde
 *   toma `input-hover`, el hover de tarjetas y opciones (§4). También sigue el
 *   hover de un `group` que la contenga. Sin sombra extra ni escala. Si además
 *   está `selected`, el hover refuerza el morado (`border-primary`) en vez de
 *   cambiarlo por gris: la selección no desaparece bajo el puntero.
 * - `dashed`: el hueco donde todavía no hay nada (un vacío, una invitación a
 *   crear): borde punteado sobre `sunk`, sin sombra.
 */
const cardSurface = "bg-card text-ink rounded-xl border border-rule shadow-sm transition-colors"

type SurfaceTone = "default" | "inverse" | "selected" | "warning" | "danger" | "sunk"

const SURFACE_TONE: Record<SurfaceTone, string | undefined> = {
  default: undefined,
  inverse: "border-primary bg-primary text-white",
  /** La tarjeta activa o elegida: borde de selección `primary/30` (Regla 3 del skill). */
  selected: "border-primary/30",
  warning: "border-warning/30",
  danger: "border-danger/30",
  sunk: "bg-sunk/50 shadow-none",
}

interface SurfaceVariantProps {
  tone?: SurfaceTone
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
  /** Lleva a algo o se elige: borde `input-hover` al pasar (propio o del `group`). */
  interactive?: boolean
  /** Hueco punteado sobre `sunk` para un vacío o una invitación a crear. */
  dashed?: boolean
}

function surfaceClasses({ tone = "default", flat = false, floating = false, interactive = false, dashed = false }: SurfaceVariantProps) {
  return cn(
    cardSurface,
    SURFACE_TONE[tone],
    flat && "shadow-none",
    floating && "rounded-md shadow-md",
    // Una tarjeta elegida no pierde su borde morado al pasar: lo refuerza.
    interactive && (tone === "selected" ? "hover:border-primary group-hover:border-primary" : "hover:border-input-hover group-hover:border-input-hover"),
    dashed && "border-2 border-dashed bg-sunk/50 shadow-none",
  )
}

function surfaceData({ tone = "default", flat, floating, interactive, dashed }: SurfaceVariantProps) {
  return {
    "data-tone": tone,
    "data-flat": flat || undefined,
    "data-floating": floating || undefined,
    "data-interactive": interactive || undefined,
    "data-dashed": dashed || undefined,
  }
}

type SurfaceTag = "div" | "section" | "article" | "li" | "ul" | "aside" | "header" | "form"

interface SurfaceProps extends React.HTMLAttributes<HTMLElement>, SurfaceVariantProps {
  /** La etiqueta semántica (una tarjeta de una lista es `li`, una ficha `article`). */
  as?: SurfaceTag
}

/**
 * La superficie de tarjeta, sin estructura: fondo, borde, radio y elevación de
 * `cardSurface`, y el relleno y el layout los pone quien la usa. Es la tarjeta
 * de una pantalla que arma su propio interior (el paso del portal, la ficha de
 * una integración). Con encabezado y cuerpo estándar, `Card` o `SectionCard`.
 */
function Surface({ as: Tag = "div", tone, flat, floating, interactive, dashed, className, ...props }: SurfaceProps) {
  const variants = { tone, flat, floating, interactive, dashed }
  return (
    <Tag
      data-slot="surface"
      {...surfaceData(variants)}
      className={cn(surfaceClasses(variants), className)}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  )
}

type CardProps = React.ComponentProps<"div"> & SurfaceVariantProps

function Card({ tone, flat, floating, interactive, dashed, className, ...props }: CardProps) {
  const variants = { tone, flat, floating, interactive, dashed }
  return (
    <div
      data-slot="card"
      {...surfaceData(variants)}
      className={cn(surfaceClasses(variants), "flex flex-col gap-6 py-6", className)}
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
  CardAction,
  CardDescription,
  CardContent,
}
