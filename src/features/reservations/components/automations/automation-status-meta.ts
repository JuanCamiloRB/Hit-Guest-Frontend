import type {
    AutomationLiveStatus,
    AutomationStatusItem,
    AutomationErrorDetail,
} from "@/features/properties/types/automation"

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

/**
 * Distinct look for `failed` when the automation had succeeded before: an orange
 * "degraded" state, not a hard red. Matches the spec's `failed` + `wasSuccessful`.
 */
export const FAILED_AFTER_SUCCESS_META: StatusMeta = {
    label: "Falló tras éxito",
    badge: "bg-orange-50 text-orange-600 border-orange-100",
    dot: "bg-orange-500",
}

/**
 * For a secondary-guest automation (e.g. "Identity Verification - Secondary
 * Guest") on a reservation with only 1 total guest: there is no secondary
 * guest to run it for, so "No iniciado" reads as "this will run eventually",
 * which is wrong — it never will. Distinct from `not_started` so it's visibly
 * not just another pending state.
 */
export const NOT_APPLICABLE_META: StatusMeta = {
    label: "No aplica",
    badge: "bg-slate-50 text-slate-400 border-slate-100",
    dot: "bg-slate-200",
}

/**
 * `AutomationStatusItem` has no structured `guestType` field (unlike the
 * property-automation config types) — the live-status endpoint only returns a
 * free-text `automationName`, so this is the only signal available to tell a
 * secondary-guest automation apart from the main-guest one.
 */
export function isSecondaryGuestAutomation(automationName: string): boolean {
    return /second|secundari/i.test(automationName)
}

/** Status meta for an item, using the orange variant for a post-success failure. */
export function getStatusMeta(
    item: Pick<AutomationStatusItem, "status" | "wasSuccessful">,
): StatusMeta {
    if (item.status === "failed" && item.wasSuccessful) return FAILED_AFTER_SUCCESS_META
    return STATUS_META[item.status]
}

/**
 * Automations that support MANUAL dispatch/redispatch from the panel — per product
 * (Ricardo, jul 2026): only TRA, SIRE (in/out) and the Guest Report PDF. Everything
 * else (identity verification, digital signature, TTLock codes, access instructions)
 * runs automatically and must NOT show a "Disparar"/"Reintentar" button, even if the
 * backend sends canDispatch/canRedispatch for them.
 */
export const MANUALLY_DISPATCHABLE_SLUGS: ReadonlySet<string> = new Set([
    "tra_colombia",
    "sire_colombia",
    "pdf_report",
])

/** Human-friendly provider labels keyed by providerSlug. */
export const PROVIDER_LABELS: Record<string, string> = {
    sire_colombia: "SIRE — Migración Colombia",
    tra_colombia: "TRA — Min. Turismo Colombia",
    ttlock: "TTLock Smart Locks",
    tufirma: "TuFirma — Firma digital",
    hitguest_signature: "Firma HIT Guest",
    pdf_report: "Reporte PDF de huéspedes",
}

/**
 * Display-title overrides keyed by providerSlug. The backend sends the automation
 * name in English (e.g. "Digital Contract"); surface the product's real Spanish
 * title instead. Falls back to `automationName` when there's no override.
 */
export const AUTOMATION_TITLE_OVERRIDES: Record<string, string> = {
    tufirma: "Firma Digital",
    hitguest_signature: "Firma Digital",
}

/**
 * Formats a backend timestamp into "d MMM, HH:mm" for display.
 * Backend serializes in America/Bogota (UTC-5, no DST) as "Y-m-d H:i:s", so we
 * parse with the fixed -05:00 offset and render in Bogota time regardless of the
 * viewer's browser timezone (this is a Colombia-first product).
 */
export function formatRunDate(ts: string | null): string {
    if (!ts) return "—"
    const normalized = ts.includes("T") ? ts : ts.replace(" ", "T") + "-05:00"
    const d = new Date(normalized)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Bogota",
    })
}

/** Formats seconds as "m:ss". */
export function formatCooldown(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, "0")}`
}

/** Human-friendly labels for a record's `triggeredBy` origin. */
export const TRIGGERED_BY_LABELS: Record<string, string> = {
    on_checkin_completed: "Check-in completado",
    on_main_guest_checkin_completed: "Check-in del titular",
    on_guest_checkin_completed: "Check-in de un huésped",
    after_automation: "Tras otra automatización",
    manual_dispatch: "Ejecución manual",
    manual_redispatch: "Reintento manual",
    manual_resend: "Reenvío manual",
}

/**
 * Known backend error CODES that arrive untranslated in `lastError.message`
 * (e.g. billing failures raised inside async jobs) → friendly Spanish.
 */
const ERROR_CODE_LABELS: Record<string, string> = {
    insufficient_balance: "Saldo insuficiente. Recarga tu saldo para ejecutar esta automatización.",
}

/** Reads a human message from a record's `lastError` (string or {message} object). */
export function errorMessage(
    err: string | AutomationErrorDetail | null | undefined,
): string | null {
    if (!err) return null
    const raw = typeof err === "string" ? err : err.message ?? null
    if (!raw) return null
    return ERROR_CODE_LABELS[raw.trim()] ?? raw
}

/**
 * Why a `not_started` automation can't be dispatched yet (checkin gate). Returns
 * null when there's no active gate blocking it.
 */
export function getCheckinBlockedMessage(item: AutomationStatusItem): string | null {
    if (!item.canManualDispatch) return null
    if (item.status !== "not_started" || item.canDispatch) return null
    if (item.requiresCheckin === "reservation" && !item.reservationCheckinCompleted) {
        return "Todos los huéspedes deben completar el check-in antes de ejecutar esta automatización."
    }
    if (item.requiresCheckin === "main_guest" && !item.mainGuestCheckinCompleted) {
        return "El huésped principal debe completar su check-in antes de ejecutar esta automatización."
    }
    return null
}

/** Why a failed automation can't be re-dispatched yet (checkin gate). */
export function getRedispatchBlockedMessage(item: AutomationStatusItem): string | null {
    if (!item.canManualDispatch) return null
    if (item.status !== "failed" || item.canRedispatch) return null
    const gate = item.requiresCheckin ?? item.redispatchRequiresCheckin
    if (gate === "reservation" && !item.reservationCheckinCompleted) {
        return "Requiere el check-in completo de la reserva para reintentar."
    }
    if (gate === "main_guest" && !item.mainGuestCheckinCompleted) {
        return "El huésped principal debe completar su check-in para poder reintentar."
    }
    return null
}
