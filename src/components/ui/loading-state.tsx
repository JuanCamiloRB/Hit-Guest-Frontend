import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Escala de espera de HitGuest (Fase 2.2). Cada espera tiene UNA forma:
 *  - Carga inicial (todavía no hay datos): `LoadingState` con la forma de lo
 *    que viene (`rows`), o `Skeleton` armado con la forma real de la pantalla.
 *  - Actualización (ya hay datos): los datos siguen visibles y se muestra
 *    `RefreshIndicator`. Nunca se vuelve al esqueleto ni a un spinner centrado.
 *  - Acción (guardar, enviar): el `loading` del Button, no un spinner aparte.
 * La regla completa (vacío, sin resultados, error, parcial, éxito) está en el
 * skill `hitguest-standards`, Regla 4.
 */

/** Lo que decide cómo se anuncia; se aplica después del spread (ver FeedbackBanner). */
type ControlledAttribute = "role" | "aria-live" | "aria-atomic" | "aria-relevant" | "aria-busy" | "aria-label"

interface LoadingStateProps extends Omit<React.ComponentProps<"div">, ControlledAttribute> {
    /**
     * `rows` imita la forma de la lista que viene, para que nada salte cuando
     * llegan los datos. `spinner` es para esperas chicas sin forma que anunciar.
     */
    variant?: "rows" | "spinner"
    /** Filas de `rows`. Igual al tamaño de página que se suele mostrar. */
    rows?: number
    /** Lo que oye un lector de pantalla mientras dura la espera. */
    label?: string
}

/**
 * El estado de carga inicial compartido. Un spinner centrado no dice qué viene
 * y deja saltar la pantalla cuando llega; las listas esperan con filas.
 */
function LoadingState({
    variant = "rows",
    rows = 5,
    label = "Cargando…",
    className,
    ...props
}: LoadingStateProps) {
    const announcement = {
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
        "aria-relevant": undefined,
        "aria-busy": undefined,
        "aria-label": label,
    } as const

    if (variant === "spinner") {
        return (
            <div
                {...props}
                {...announcement}
                data-slot="loading-state"
                data-variant="spinner"
                className={cn("flex items-center justify-center py-10", className)}
            >
                <Loader2 aria-hidden className="size-5 animate-spin text-ink-4" />
                <span className="sr-only">{label}</span>
            </div>
        )
    }

    return (
        <div
            {...props}
            {...announcement}
            data-slot="loading-state"
            data-variant="rows"
            className={cn("flex flex-col gap-3 p-4", className)}
        >
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} aria-hidden className="flex items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-1/5" />
                    </div>
                    <Skeleton className="h-6 w-20 shrink-0" />
                </div>
            ))}
            <span className="sr-only">{label}</span>
        </div>
    )
}

interface RefreshIndicatorProps extends Omit<React.ComponentProps<"span">, ControlledAttribute | "children"> {
    /** `true` mientras se actualizan datos que YA están en pantalla. */
    active: boolean
    /** Texto visible y anunciado. */
    label?: string
}

/**
 * «Actualizando…» discreto para cuando los datos ya están en pantalla y se
 * vuelven a pedir: los datos no se reemplazan por un esqueleto.
 *
 * La región `status` queda SIEMPRE montada y solo cambia su contenido: así el
 * anuncio es fiable (una región que se monta ya con texto no todos los lectores
 * la anuncian). Inactivo no ocupa lugar ni se ve. Va junto al título o a las
 * acciones de la sección que se actualiza.
 */
function RefreshIndicator({ active, label = "Actualizando…", className, ...props }: RefreshIndicatorProps) {
    return (
        <span
            {...props}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-relevant={undefined}
            aria-busy={undefined}
            aria-label={undefined}
            data-slot="refresh-indicator"
            data-active={active}
            className={cn("inline-flex items-center gap-1.5 text-xs text-ink-3", !active && "sr-only", className)}
        >
            {active && (
                <>
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    {label}
                </>
            )}
        </span>
    )
}

export { LoadingState, RefreshIndicator }
