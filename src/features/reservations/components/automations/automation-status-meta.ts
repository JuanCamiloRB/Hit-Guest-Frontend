import type { AutomationLiveStatus } from "@/features/properties/types/automation"

interface StatusMeta {
    label: string
    /** Tailwind classes for the badge pill. */
    badge: string
    /** Tailwind classes for the colored status dot. */
    dot: string
}

export const STATUS_META: Record<AutomationLiveStatus, StatusMeta> = {
    completed: {
        label: "Completado",
        badge: "bg-emerald-50 text-emerald-600 border-emerald-100",
        dot: "bg-emerald-500",
    },
    failed: {
        label: "Fallido",
        badge: "bg-red-50 text-red-600 border-red-100",
        dot: "bg-red-500",
    },
    pending: {
        label: "Procesando",
        badge: "bg-amber-50 text-amber-600 border-amber-100",
        dot: "bg-amber-500 animate-pulse",
    },
    not_started: {
        label: "No iniciado",
        badge: "bg-slate-50 text-slate-500 border-slate-200",
        dot: "bg-slate-300",
    },
}

/** Human-friendly provider labels keyed by providerSlug. */
export const PROVIDER_LABELS: Record<string, string> = {
    sire_colombia: "SIRE — Migración Colombia",
    tra_colombia: "TRA — Min. Turismo Colombia",
    ttlock: "TTLock Smart Locks",
    tufirma: "TuFirma — Firma digital",
    pdf_report: "Reporte PDF de huéspedes",
}

/** Formats a backend UTC timestamp into local "d MMM, HH:mm" for display. */
export function formatRunDate(ts: string | null): string {
    if (!ts) return "—"
    const normalized = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z"
    const d = new Date(normalized)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/** Formats seconds as "m:ss". */
export function formatCooldown(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, "0")}`
}
