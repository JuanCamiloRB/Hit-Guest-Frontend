"use client"

import { CheckCircle2, XCircle, Clock, Archive, Trash2, HelpCircle } from "lucide-react"
import type { Reservation } from "@/types"
import { cn } from "@/lib/utils"

/**
 * Compact reservation-status indicator for the list. This is HitGuest's own internal
 * status (catalog_category_id 7), not a PMS status, and it is distinct from the
 * operational automation traffic light in the next column.
 *
 * Only Confirmada (27) and En Progreso (28) enable the reservation's automations —
 * the tooltip says so, since a PM otherwise can't tell why nothing fired.
 */
const STATUS_META: Record<
    string,
    { Icon: typeof CheckCircle2; className: string; label: string }
> = {
    CONFIRMED: { Icon: CheckCircle2, className: "text-emerald-500", label: "Confirmada" },
    IN_PROGRESS: { Icon: Clock, className: "text-blue-500", label: "En Progreso" },
    CANCELLED: { Icon: XCircle, className: "text-red-500", label: "Cancelada" },
    CLOSED: { Icon: Archive, className: "text-slate-400", label: "Finalizada" },
    DELETED: { Icon: Trash2, className: "text-slate-400", label: "Eliminada" },
    UNKNOWN: { Icon: HelpCircle, className: "text-slate-300", label: "Desconocido" },
}

const AUTOMATION_ENABLED = new Set(["CONFIRMED", "IN_PROGRESS"])

export function ReservationStatusIcon({ status }: { status: Reservation["status"] }) {
    const meta = STATUS_META[status] ?? STATUS_META.UNKNOWN
    const { Icon } = meta
    const title = AUTOMATION_ENABLED.has(status)
        ? `${meta.label} · automatizaciones activas`
        : `${meta.label} · sin automatizaciones`

    return (
        <span title={title} aria-label={title} className="inline-flex items-center justify-center">
            <Icon className={cn("h-5 w-5", meta.className)} />
        </span>
    )
}
