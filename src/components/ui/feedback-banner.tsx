import * as React from "react"
import { cva } from "class-variance-authority"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * El aviso de HitGuest: información, éxito, advertencia o error (Fase 2.1).
 * Reemplaza a los avisos armados a mano en cada pantalla (`bg-amber-50 …`),
 * cada uno con su rojo, su ámbar y su `role` elegido a ojo.
 *
 * Tres reglas que impone:
 *  • El tono va en el ícono y en el título, nunca solo en el color de fondo;
 *    el texto tiene que entenderse sin verlo («No se pudo guardar», no «Error»).
 *  • Colores solo de tokens: `--{tono}` (tinta, 4.6:1 sobre su fondo) y
 *    `--{tono}-sunk` (fondo). El cuerpo va en `ink-2` (6.4:1 o más).
 *  • Cómo se anuncia no lo elige la pantalla: `role`, `aria-live`, `aria-atomic`,
 *    `aria-relevant` y `aria-busy` salen de `mode` (ver `FeedbackBannerMode`).
 *    Si llegan como props (algunos compilan en JSX, ver `ControlledAttribute`),
 *    el componente los ignora y los reemplaza.
 */

type FeedbackBannerTone = "info" | "success" | "warning" | "danger"

/**
 * Cómo llega el aviso a un lector de pantalla:
 *  - `static`: parte fija de la pantalla (p. ej. «Esta propiedad no tiene PMS»).
 *    Se lee al recorrer la página; no se anuncia. Sin `role`.
 *  - `dynamic`: aparece o cambia por algo que hizo el usuario o la pantalla
 *    (p. ej. «Guardado», «Se reintentó la carga»). `role="status"`: se anuncia
 *    sin interrumpir.
 *  - `blocking`: un error que impide continuar. `role="alert"`: interrumpe.
 *    Solo con `tone="danger"` (lo impone el tipo): una advertencia que
 *    interrumpe es ruido.
 *
 * Un `status` se anuncia de forma fiable cuando su CONTENIDO cambia con el
 * contenedor ya montado. Si el aviso se monta ya con el texto, la mayoría de los
 * lectores lo anuncian igual, pero no todos: para un mensaje crítico, mantener
 * el aviso montado y cambiar su contenido.
 */
type FeedbackBannerMode = "static" | "dynamic" | "blocking"

/**
 * Todo lo que decide cómo se anuncia el aviso, por modo. Se aplica DESPUÉS de
 * propagar las props: ni una prop ni un objeto propagado puede cambiarlo (un
 * `aria-live="assertive"` volvería interruptivo un aviso `dynamic`, y un
 * `aria-busy` lo silenciaría). Los valores implícitos de `status` y `alert` se
 * escriben explícitos para no depender de cómo los infiera cada lector.
 */
const ANNOUNCEMENT: Record<FeedbackBannerMode, {
    role: "status" | "alert" | undefined
    "aria-live": "polite" | "assertive" | undefined
    "aria-atomic": "true" | undefined
    "aria-relevant": undefined
    "aria-busy": undefined
}> = {
    static: { role: undefined, "aria-live": undefined, "aria-atomic": undefined, "aria-relevant": undefined, "aria-busy": undefined },
    dynamic: { role: "status", "aria-live": "polite", "aria-atomic": "true", "aria-relevant": undefined, "aria-busy": undefined },
    blocking: { role: "alert", "aria-live": "assertive", "aria-atomic": "true", "aria-relevant": undefined, "aria-busy": undefined },
}

/**
 * Atributos que controla el componente; fuera de las props públicas. El tipo
 * solo bloquea `role`: en JSX, TypeScript no revisa los atributos con guion no
 * declarados (`aria-live="assertive"` compila igual). Lo que lo garantiza es el
 * orden del render: `ANNOUNCEMENT` va después del spread.
 */
type ControlledAttribute = "role" | "aria-live" | "aria-atomic" | "aria-relevant" | "aria-busy"

const ICON: Record<FeedbackBannerTone, LucideIcon> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: AlertCircle,
}

/**
 * Las dos densidades de la Fase 1 (paso 4.5), aplicadas al aviso:
 *  - `default`: avisos de página, de formulario y de diálogo (14 px).
 *  - `compact`: dentro de tarjetas y filas densas (12 px, ícono de 14 px).
 * Las clases de cada parte viven juntas para que no se desalineen.
 */
type FeedbackBannerDensity = "default" | "compact"

const DENSITY: Record<FeedbackBannerDensity, { root: string; row: string; icon: string; action: string }> = {
    default: { root: "gap-3 py-2.5 text-sm", row: "gap-2", icon: "mt-0.5 size-4", action: "pl-6" },
    // ícono 14 px + separación 6 px = pl-5
    compact: { root: "gap-2 py-2 text-xs", row: "gap-1.5", icon: "mt-px size-3.5", action: "pl-5" },
}

const feedbackBannerVariants = cva(
    "flex flex-col rounded-lg px-3 sm:flex-row sm:items-start sm:justify-between",
    {
        variants: {
            tone: {
                info: "bg-info-sunk",
                success: "bg-success-sunk",
                warning: "bg-warning-sunk",
                danger: "bg-danger-sunk",
            },
        },
    },
)

/** Tinta del tono: ícono y título. Clases completas para que Tailwind las genere. */
const TONE_INK: Record<FeedbackBannerTone, string> = {
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
}

type ToneAndMode =
    | { tone: "danger"; mode?: FeedbackBannerMode }
    | { tone: Exclude<FeedbackBannerTone, "danger">; mode?: Exclude<FeedbackBannerMode, "blocking"> }

type FeedbackBannerProps = Omit<React.ComponentProps<"div">, "title" | ControlledAttribute> &
    ToneAndMode & {
        /** Opcional. Corto: lo que pasó o lo que hay que hacer. */
        title?: React.ReactNode
        /** El detalle. Puede llevar enlaces. */
        children?: React.ReactNode
        /** Una acción que resuelve el aviso («Reintentar», «Configurar»). Normalmente un `<Button size="sm">`. */
        action?: React.ReactNode
        /** `compact` dentro de tarjetas y filas densas. */
        density?: FeedbackBannerDensity
    }

function FeedbackBanner({
    tone,
    mode = "static",
    title,
    children,
    action,
    density = "default",
    className,
    ...props
}: FeedbackBannerProps) {
    const Icon = ICON[tone]
    const size = DENSITY[density]
    return (
        <div
            {...props}
            // Después del spread a propósito: la semántica y los datos del aviso
            // los fija el componente, no quien lo usa.
            {...ANNOUNCEMENT[mode]}
            data-slot="feedback-banner"
            data-tone={tone}
            data-mode={mode}
            data-density={density}
            className={cn(feedbackBannerVariants({ tone }), size.root, className)}
        >
            <div className={cn("flex min-w-0 items-start", size.row)}>
                <Icon aria-hidden className={cn("shrink-0", size.icon, TONE_INK[tone])} />
                <div className="min-w-0 space-y-0.5">
                    {title != null && title !== "" && (
                        <p data-slot="feedback-banner-title" className={cn("font-semibold", TONE_INK[tone])}>
                            {title}
                        </p>
                    )}
                    {children != null && children !== "" && (
                        <div data-slot="feedback-banner-description" className="text-ink-2">
                            {children}
                        </div>
                    )}
                </div>
            </div>
            {action != null && (
                // En móvil la acción baja y se alinea con el texto, no con el ícono.
                <div data-slot="feedback-banner-action" className={cn("shrink-0 sm:self-center sm:pl-0", size.action)}>
                    {action}
                </div>
            )}
        </div>
    )
}

export { FeedbackBanner, type FeedbackBannerTone, type FeedbackBannerMode, type FeedbackBannerDensity }
