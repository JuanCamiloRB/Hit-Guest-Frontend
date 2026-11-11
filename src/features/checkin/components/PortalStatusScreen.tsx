import { XCircle, Trash2, Clock, PauseCircle } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import type { PortalStatus } from "../types/checkin"

interface PortalStatusScreenProps {
    status: PortalStatus
    message?: string
}

const STATUS_CONTENT: Partial<Record<
    PortalStatus,
    { icon: typeof XCircle; title: string; defaultMessage: string; accent: string }
>> = {
    cancelled: {
        icon: XCircle,
        title: "Reserva cancelada",
        defaultMessage:
            "Esta reserva fue cancelada y ya no está disponible para el check-in.",
        accent: "text-warning bg-warning-sunk",
    },
    deleted: {
        icon: Trash2,
        title: "Reserva no disponible",
        defaultMessage: "Esta reserva ya no existe.",
        accent: "text-danger bg-danger-sunk",
    },
    // Airbnb iCal (2026-09-04): la reserva existe en Airbnb pero HIT todavía no
    // la sincronizó. A diferencia de los otros estados, este se resuelve SOLO
    // (el calendario se lee cada 30 min) — por eso es el único con Reintentar.
    // Contrato 2026-10-27: el alojamiento o su propiedad están inactivos. Lo
    // resuelve el anfitrión, no el huésped: sin Reintentar.
    listing_inactive: {
        icon: PauseCircle,
        title: "Check-in no disponible por ahora",
        defaultMessage:
            "Esta reserva no puede procesarse porque el alojamiento asociado está inactivo o ya no existe.",
        accent: "text-ink-3 bg-sunk",
    },
    pending_sync: {
        icon: Clock,
        title: "Estamos preparando tu check-in",
        defaultMessage: "Todavía estamos preparando tu check-in. Inténtalo de nuevo en unos minutos.",
        accent: "text-info bg-info-sunk",
    },
}

export function PortalStatusScreen({ status, message }: PortalStatusScreenProps) {
    // `classifyPortalPayload` acepta CUALQUIER portalStatus string a propósito
    // (nunca ocultar lo que el backend afirma) — así que un estado que esta
    // pantalla no conoce debe degradar a un contenido genérico, no reventar.
    const content = STATUS_CONTENT[status] ?? {
        icon: XCircle,
        title: "Reserva no disponible",
        defaultMessage: "Esta reserva no está disponible para el check-in en este momento.",
        accent: "text-warning bg-warning-sunk",
    }
    const glyph = content.icon

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-in fade-in duration-500">
            <div className={`rounded-full p-4 mb-5 ${content.accent}`}>
                <Icon icon={glyph} size="3xl" weight="light" />
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">{content.title}</h1>
            <p className="text-ink-3 max-w-md leading-relaxed">
                {message || content.defaultMessage}
            </p>
            {status === "pending_sync" && (
                /* <a href=""> recarga la misma URL sin necesitar JS: esta pantalla
                   se renderiza en el servidor. */
                <a
                    href=""
                    className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white transition-all active:scale-[0.98]"
                >
                    Reintentar
                </a>
            )}
            <p className="text-xs text-ink-3 mt-8">
                Si crees que esto es un error, contacta a tu anfitrión.
            </p>
        </div>
    )
}
