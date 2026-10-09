import type { StatusTone } from "@/components/ui/status-pill"
import type { Reservation } from "@/types"

interface ReservationStatusMeta {
    label: string
    tone: StatusTone
}

/**
 * Display meta for every reservation status the service can produce
 * (`RESERVATION_STATUS_BY_ID` in reservations-service maps catalog ids 27-30,
 * 108, 109).
 *
 * The panel previously rendered a binary `CONFIRMED ? "CONFIRMADA" : "PENDIENTE"`,
 * so a CANCELLED, CLOSED or DELETED reservation was shown to the operator as an
 * amber "PENDIENTE" — i.e. as something still actionable. Every status now has
 * its own label and tone.
 *
 * Tones are the shared `StatusPill` set, not per-screen hexes: the same state
 * must not be emerald here and #0bb37a two components over.
 */
export const RESERVATION_STATUS_META: Record<Reservation["status"], ReservationStatusMeta> = {
    // Ciclo de vida de la reserva — lo que mapea RESERVATION_STATUS_BY_ID.
    CONFIRMED: { label: "Confirmada", tone: "success" },
    IN_PROGRESS: { label: "En progreso", tone: "info" },
    CANCELLED: { label: "Cancelada", tone: "danger" },
    CLOSED: { label: "Finalizada", tone: "idle" },
    DELETED: { label: "Eliminada", tone: "danger" },
    UNKNOWN: { label: "Sin estado", tone: "warning" },
    // Catálogo verificado 2026-10-09 (859/860).
    ABANDONED: { label: "Abandonada", tone: "warning" },
    INCOMPLETE: { label: "Incompleta", tone: "warning" },
    // Estados del flujo de check-in que el mismo union admite (los que pinta
    // StatusBadge). Van aquí para que el tipo esté cubierto y para que, si
    // alguno llega al panel, se lea igual que en el resto de la app.
    LINK_SENT: { label: "Link enviado", tone: "info" },
    PENDING: { label: "Check-in pendiente", tone: "warning" },
    PENDING_CONTRACT: { label: "Pendiente de contrato", tone: "warning" },
    CHECKED_IN: { label: "Check-in completo", tone: "success" },
    CHECKED_OUT: { label: "Check-out realizado", tone: "idle" },
    NO_STARTED: { label: "No iniciado", tone: "idle" },
}

/**
 * `backendLabel`: el nombre que mandó el backend. Solo se usa cuando el estado
 * no se pudo mapear (`UNKNOWN`): un estado nuevo del catálogo se muestra con su
 * nombre real, nunca como un «Sin estado» genérico.
 */
export function getReservationStatusMeta(
    status: Reservation["status"],
    backendLabel?: string | null,
    statusId?: number | null,
): ReservationStatusMeta {
    const meta = RESERVATION_STATUS_META[status] ?? RESERVATION_STATUS_META.UNKNOWN
    const label = unmappedStatusLabel(status, backendLabel, statusId)
    return label ? { ...meta, label } : meta
}

/**
 * Etiqueta para un estado que el front no pudo mapear. Distingue los tres
 * casos que antes se veían iguales: el backend nombra el estado (se usa su
 * nombre); trae un id que no conocemos y sin nombre («Estado no reconocido
 * (ID 861)»); o no trae estado (`null`: queda la etiqueta por defecto). El 109
 * es «Desconocido» de verdad en el catálogo, no un id sin reconocer.
 */
export function unmappedStatusLabel(
    status: Reservation["status"],
    backendLabel?: string | null,
    statusId?: number | null,
): string | null {
    if (status !== "UNKNOWN") return null
    if (backendLabel) return backendLabel
    if (statusId != null && statusId !== 109) return `Estado no reconocido (ID ${statusId})`
    return null
}

/**
 * Statuses where the reservation is over or void, so guest-facing actions
 * (sending or copying a check-in link, messaging the guest) are pointless.
 *
 * Expressed as a deny-list rather than an allow-list of CONFIRMED/IN_PROGRESS:
 * the union also carries check-in-flow states, and an allow-list would have
 * silently disabled the actions for a reservation that is merely PENDING —
 * exactly the one that most needs its link re-sent.
 */
const TERMINAL_STATUSES: ReadonlySet<Reservation["status"]> = new Set([
    "CANCELLED",
    "CLOSED",
    "DELETED",
    "CHECKED_OUT",
    // No sabemos si son terminales (el backend no lo documenta), pero sí que el
    // portal solo admite check-in con 27 y 28 (`checkinAllowed`, referencia de
    // endpoints del portal §1): un link enviado acá lleva a «check-in no
    // disponible», y por WhatsApp se cobra igual. Bloquear es lo seguro hasta
    // que el backend diga si pueden retomarse.
    "ABANDONED",
    "INCOMPLETE",
])

export function isReservationActionable(status: Reservation["status"]): boolean {
    return !TERMINAL_STATUSES.has(status)
}

/**
 * Reservations booked through a channel manager / OTA. Direct reservations are
 * created inside HitGuest, so labelling them "Reserva Externa" (as the panel
 * did unconditionally) contradicted the "Plataforma Direct" line right next to it.
 */
export function isExternalReservation(source: "Airbnb" | "Booking" | "Direct"): boolean {
    return source !== "Direct"
}

/**
 * Guest names arrive from the PMS in arbitrary casing ("carolina rodriguez",
 * "CAROLINA RODRIGUEZ"). Title-cases for display without touching the stored value.
 */
export function formatGuestName(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .map(word =>
            word.length <= 3 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ")
}

/** Up-to-two-letter initials for the avatar, from an already-formatted name. */
export function guestInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
