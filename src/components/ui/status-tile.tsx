"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check, Clock, Minus, X, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/**
 * La celda de estado de ancho fijo de una tabla densa (Operaciones): el ícono
 * de lo que mide, una marca de FORMA según el tono (✓ hecho, reloj pendiente,
 * ✕ falló; sin marca = todavía no corre) y, si aplica, un contador corto
 * («1/2»). El estado nunca depende solo del color (WCAG 1.4.1).
 *
 * Todas miden lo mismo (64 × 32 px): «2 de 2 completados» y «Enviado» ya no
 * ocupan anchos distintos. Con ocho columnas la tabla tiene que caber en 1440 px
 * con la barra lateral abierta: por eso 64 y no más. Lo que dice cada una se lee en el encabezado de su columna y en su
 * nombre accesible (`label`, obligatorio); el detalle va en un `Toggletip`.
 *
 * `data` es un dato contable con su ícono (Alojamientos: la capacidad): la
 * misma celda y el mismo detalle que un estado, en el morado claro de
 * HitGuest (como `Badge accent`) y sin marca de forma porque no hay nada hecho
 * ni pendiente. El texto va en `primary-hover`: con `primary` bajaría a 4.41:1
 * sobre una fila en hover; así queda en 5.38:1.
 *
 * Es un `<button>`: se enfoca y se pulsa para abrir el detalle. `none` («no
 * configurada») muestra solo el guion y no se ofrece como control si no tiene
 * detalle que abrir (`disabled`).
 */
const statusTileVariants = cva(
    [
        "inline-flex h-8 w-16 shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-md border px-1",
        "text-xs font-semibold tabular-nums transition-colors outline-none select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "enabled:cursor-pointer enabled:hover:border-primary/30 disabled:cursor-default",
    ],
    {
        variants: {
            tone: {
                success: "border-success/20 bg-success-sunk text-success",
                warning: "border-warning/30 bg-warning-sunk text-warning",
                danger: "border-danger/30 bg-danger-sunk text-danger",
                // Configurada pero todavía no corre: el ícono en gris, sin marca.
                idle: "border-rule bg-card text-ink-3",
                // Un DATO, no un estado (la capacidad): morado claro, como el
                // ámbar de «pendiente» pero sin marca. Mismo tamaño.
                data: "border-primary/30 bg-primary/10 text-primary-hover enabled:hover:border-primary/50",
                // No configurada / no aplica: solo el guion, borde punteado.
                none: "border-dashed border-rule bg-transparent text-ink-4",
            },
        },
        defaultVariants: { tone: "idle" },
    },
)

type StatusTileTone = NonNullable<VariantProps<typeof statusTileVariants>["tone"]>

const GLYPH: Record<StatusTileTone, LucideIcon | null> = {
    success: Check,
    warning: Clock,
    danger: X,
    idle: null,
    data: null,
    none: null,
}

interface StatusTileProps extends React.ComponentProps<"button"> {
    tone: StatusTileTone
    /** Nombre accesible completo: «Contrato: firmado». */
    label: string
    /** El ícono de lo que mide la columna. */
    icon?: LucideIcon
    /** «1/2». */
    count?: string
    /** Íconos propios en lugar de `icon` (los canales del link). */
    children?: React.ReactNode
}

function StatusTile({ tone, label, icon, count, children, className, type = "button", ...props }: StatusTileProps) {
    const glyph = GLYPH[tone]
    return (
        <button
            type={type}
            {...props}
            aria-label={label}
            data-slot="status-tile"
            data-tone={tone}
            className={cn(statusTileVariants({ tone }), className)}
        >
            {tone === "none" ? (
                <Icon icon={Minus} size="sm" />
            ) : (
                <>
                    {children ?? (icon && <Icon icon={icon} size="sm" />)}
                    {count && <span data-slot="status-tile-count">{count}</span>}
                    {glyph && (
                        <span data-slot="status-tile-glyph" className="inline-flex">
                            <Icon icon={glyph} size="xs" weight="bold" />
                        </span>
                    )}
                </>
            )}
        </button>
    )
}

/**
 * El mismo hueco mientras el dato llega: un esqueleto del ancho de la celda,
 * para que la tabla no salte cuando aparece.
 */
function StatusTileSkeleton({ label = "Cargando estado" }: { label?: string }) {
    return (
        <span data-slot="status-tile-skeleton" className="inline-flex h-8 w-16 animate-pulse rounded-md bg-sunk motion-reduce:animate-none">
            <span className="sr-only">{label}</span>
        </span>
    )
}

export { StatusTile, StatusTileSkeleton, statusTileVariants }
export type { StatusTileProps, StatusTileTone }
