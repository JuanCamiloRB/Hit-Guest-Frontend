"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { Check, Clock, Minus, X, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icon } from "./icon"

/**
 * El detalle corto de un control que ya se entiende solo (una celda de estado):
 * qué canal se usó, qué se firmó, cómo va cada huésped. Se abre de las tres
 * formas en que alguien lo busca, sin clic obligatorio:
 *
 *   - mouse: al pasar por encima (con una espera corta para no parpadear);
 *   - teclado: al enfocar con Tab (solo foco visible: un clic de mouse no lo
 *     abre dos veces);
 *   - toque: al tocar (y otro toque lo cierra).
 *
 * Un clic con el detalle abierto por hover lo FIJA en lugar de cerrarlo. Escape
 * y un clic fuera cierran. No mueve el foco: quien lee con teclado sigue en la
 * celda, y el detalle queda enlazado por `aria-describedby` mientras se ve.
 *
 * Por qué no `Tooltip`: el de Radix no abre al tocar y se cierra con el clic, y
 * un detalle que solo existe con mouse deja fuera a tablet, móvil y teclado.
 */
const HOVER_DELAY_MS = 120

interface ToggletipProps {
    /** El control que lo abre (un solo elemento; recibe ref y eventos). */
    children: React.ReactElement
    /** El detalle: `ToggletipTitle`, `ToggletipLine`, `ToggletipNote`. */
    content: React.ReactNode
    /** Nombre accesible del panel («Contrato»): Radix lo expone como región con rol. */
    label?: string
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
}

/**
 * Un solo detalle abierto a la vez en toda la pantalla: abrir el de una celda
 * cierra el que estuviera fijado en otra.
 */
let closeOpenDetail: (() => void) | null = null

function Toggletip({ children, content, label, side = "bottom", align = "center" }: ToggletipProps) {
    const [open, setOpen] = React.useState(false)
    // Fijado por clic o toque. En estado (no solo ref): decide si el panel
    // recibe el puntero.
    const [pinned, setPinned] = React.useState(false)
    const pinnedRef = React.useRef(false)
    // El foco que sigue a un `pointerdown` viene de un clic o un toque, no del teclado.
    const pointerDownRef = React.useRef(false)
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const detailId = React.useId()

    const clear = () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = null
    }
    const pin = (value: boolean) => {
        pinnedRef.current = value
        setPinned(value)
    }

    const change = React.useCallback((next: boolean) => {
        clear()
        if (!next) {
            pinnedRef.current = false
            setPinned(false)
        }
        setOpen(next)
    }, [])
    const later = (next: boolean) => {
        clear()
        timerRef.current = setTimeout(() => change(next), HOVER_DELAY_MS)
    }

    // Uno a la vez, y fuera al desplazar: un detalle fijado se quedaba encima de
    // la columna fija cuando su celda se iba por debajo al desplazar la tabla.
    React.useEffect(() => {
        if (!open) return
        const close = () => change(false)
        if (closeOpenDetail && closeOpenDetail !== close) closeOpenDetail()
        closeOpenDetail = close
        window.addEventListener("scroll", close, { capture: true, passive: true })
        return () => {
            window.removeEventListener("scroll", close, { capture: true })
            if (closeOpenDetail === close) closeOpenDetail = null
        }
    }, [open, change])
    React.useEffect(() => clear, [])

    const onPointerEnter = (event: React.PointerEvent) => {
        if (event.pointerType === "mouse") later(true)
    }
    const onPointerLeave = (event: React.PointerEvent) => {
        if (event.pointerType === "mouse" && !pinnedRef.current) later(false)
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={change}>
            <PopoverPrimitive.Trigger
                asChild
                aria-describedby={open ? detailId : undefined}
                onPointerEnter={onPointerEnter}
                onPointerLeave={onPointerLeave}
                onPointerDown={() => {
                    pointerDownRef.current = true
                    setTimeout(() => { pointerDownRef.current = false }, 0)
                }}
                onFocus={() => {
                    // Solo el foco de teclado: el de un clic o un toque lo maneja el clic.
                    if (!pointerDownRef.current) change(true)
                }}
                onBlur={() => {
                    if (!pinnedRef.current) change(false)
                }}
                onClick={(event) => {
                    // Abierto por hover o foco: el clic lo fija (no lo cierra).
                    if (open && !pinnedRef.current) {
                        event.preventDefault()
                        clear()
                        pin(true)
                        return
                    }
                    // Cerrado: Radix lo abre; queda fijo hasta otro clic, Escape o un clic fuera.
                    if (!open) pin(true)
                }}
            >
                {children}
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    data-slot="toggletip-content"
                    data-pinned={pinned || undefined}
                    aria-label={label}
                    side={side}
                    align={align}
                    sideOffset={6}
                    collisionPadding={12}
                    // Informa, no es un diálogo: el foco se queda en el control.
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    // El portal no corta el burbujeo de React: sin esto, un clic dentro
                    // del detalle llegaba a la fila de la tabla y la hacía navegar.
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                        "z-50 grid w-max max-w-80 gap-2 rounded-lg border border-rule bg-card p-3 text-xs text-ink-2 shadow-md outline-hidden",
                        // Abierto por hover o teclado no captura el puntero: tapa la celda
                        // de la fila de abajo y bajar por la columna tiene que seguir
                        // abriendo cada celda. Fijado (clic o toque) sí.
                        !pinned && "pointer-events-none",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none",
                    )}
                >
                    <div id={detailId} className="grid gap-2">{content}</div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    )
}

function ToggletipTitle({ className, ...props }: React.ComponentProps<"p">) {
    return <p data-slot="toggletip-title" className={cn("text-xs font-semibold text-ink", className)} {...props} />
}

type ToggletipTone = "success" | "warning" | "danger" | "idle" | "none"

const LINE_GLYPH: Record<ToggletipTone, { icon: LucideIcon; className: string }> = {
    success: { icon: Check, className: "text-success" },
    warning: { icon: Clock, className: "text-warning" },
    danger: { icon: X, className: "text-danger" },
    idle: { icon: Clock, className: "text-ink-3" },
    none: { icon: Minus, className: "text-ink-4" },
}

type ToggletipLineProps = React.ComponentProps<"p"> & (
    /** Un estado: la misma marca de forma que la celda. */
    | { tone: ToggletipTone; icon?: never }
    /** Un dato (celda `neutral`): el ícono de lo que es, en tinta tenue. */
    | { icon: LucideIcon; tone?: never }
)

/** Una línea del detalle: con la marca del estado, o con el ícono del dato. */
function ToggletipLine({ tone, icon, className, children, ...props }: ToggletipLineProps) {
    const glyph = tone ? LINE_GLYPH[tone] : null
    return (
        <p data-slot="toggletip-line" data-tone={tone ?? "neutral"} className={cn("flex items-start gap-2 leading-snug", className)} {...props}>
            {glyph
                ? <Icon icon={glyph.icon} size="xs" weight="bold" className={cn("mt-0.5", glyph.className)} />
                : icon && <Icon icon={icon} size="xs" className="mt-0.5 text-ink-3" />}
            <span className="min-w-0">{children}</span>
        </p>
    )
}

function ToggletipNote({ className, ...props }: React.ComponentProps<"p">) {
    return <p data-slot="toggletip-note" className={cn("border-t border-rule pt-2 text-ink-3", className)} {...props} />
}

export { Toggletip, ToggletipTitle, ToggletipLine, ToggletipNote }
export type { ToggletipProps, ToggletipTone }
