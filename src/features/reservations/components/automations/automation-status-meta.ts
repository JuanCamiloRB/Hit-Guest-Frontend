import type { StatusTone } from "@/components/ui/status-pill"
import { AUTOMATION_DEFINITIONS } from "@/features/properties/data/automation-definitions"
import { canonicalSlug } from "@/features/properties/services/automation-service"
import type {
    AutomationLiveStatus,
    AutomationStatusItem,
    AutomationErrorDetail,
} from "@/features/properties/types/automation"

interface StatusMeta {
    label: string
    /** Tone from the shared `StatusPill` scale — never a per-component hex. */
    tone: StatusTone
    /** Set on states that are actively changing, so the dot pulses. */
    pulse?: boolean
}

export const STATUS_META: Record<AutomationLiveStatus, StatusMeta> = {
    completed: { label: "Completado", tone: "success" },
    failed: { label: "Fallido", tone: "danger" },
    pending: { label: "Procesando", tone: "warning", pulse: true },
    not_started: { label: "No iniciado", tone: "idle" },
}

/**
 * Distinct look for `failed` when the automation had succeeded before: a
 * "degraded" warning, not a hard failure. Matches the spec's `failed` +
 * `wasSuccessful`.
 */
export const FAILED_AFTER_SUCCESS_META: StatusMeta = {
    label: "Falló tras éxito",
    tone: "warning",
}

/**
 * For a secondary-guest automation (e.g. "Identity Verification - Secondary
 * Guest") on a reservation with only 1 total guest: there is no secondary
 * guest to run it for, so "No iniciado" reads as "this will run eventually",
 * which is wrong — it never will.
 *
 * Uses `tone="none"`, which renders a bare dash instead of a pill: absence is
 * not a state, and a grey "No aplica" chip competed for attention with the
 * rows that actually need the operator to do something.
 */
export const NOT_APPLICABLE_META: StatusMeta = {
    label: "No aplica",
    tone: "none",
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

/**
 * Etiquetas que el PM ya eligió al configurar la propiedad, indexadas por
 * providerSlug. Se derivan de `AUTOMATION_DEFINITIONS` en vez de repetirse
 * aquí: si alguien renombra una opción en Propiedades, Operaciones la sigue
 * sola en lugar de quedarse con el nombre viejo.
 *
 * Esto cubre sobre todo las de identidad, donde el PM elige entre
 * "Verificación avanzada" y "Verificación esencial" — mostrarle "Didit" o
 * "AWS Textract" en Operaciones le hablaba de un proveedor que él nunca vio,
 * con un vocabulario distinto al de la pantalla donde lo configuró.
 */
const PROVIDER_LABELS_FROM_DEFINITIONS: Record<string, string> = Object.fromEntries(
    AUTOMATION_DEFINITIONS.flatMap((definition) =>
        definition.providerOptions.map(
            // Las definiciones escriben los slugs con guion ("pdf-report") y
            // `normalizeStatusItem` los canonicaliza a guion bajo, así que sin
            // esto las claves derivadas no cruzarían con las que llegan del API.
            (option) => [canonicalSlug(option.value), option.label] as const,
        ),
    ),
)

/**
 * El SUBTÍTULO de una fila. Debe decir algo que el título no diga ya: la
 * etiqueta anterior de `pdf_report` era "Reporte PDF de huéspedes" y quedaba
 * justo debajo del título "Guest Report PDF".
 *
 * Las entradas de aquí son overrides sobre las derivadas arriba, para los
 * proveedores donde nombrar al organismo SÍ aporta (SIRE, TRA).
 */
const PROVIDER_LABEL_OVERRIDES: Record<string, string> = {
    sire_colombia: "Migración Colombia · SIRE",
    tra_colombia: "MinCIT · TRA",
    ttlock: "TTLock",
    tufirma: "TuFirma",
    hitguest_signature: "HIT Guest",
    pdf_report: "HIT Guest",
}

export const PROVIDER_LABELS: Record<string, string> = {
    ...PROVIDER_LABELS_FROM_DEFINITIONS,
    ...PROVIDER_LABEL_OVERRIDES,
}

/**
 * El texto en español NO se escribe acá: sale del `title` de la definición, que
 * es el que el PM lee al configurar la propiedad. Tener una segunda lista de
 * títulos a mano fue lo que hizo que Operaciones y Propiedades nombraran la
 * misma automatización de dos formas distintas.
 */
const TITLE_BY_DEFINITION_ID: Record<string, string> = Object.fromEntries(
    AUTOMATION_DEFINITIONS.map((definition) => [definition.id, definition.title]),
)

/**
 * Une el `automationName` en inglés que manda `/automation-status` con la
 * definición canónica de Propiedades. El nombre es la ÚNICA llave disponible:
 * el payload de estado no trae `executionOrder`, y el providerSlug no alcanza
 * porque en una respuesta real las dos filas de identidad llegaron con
 * proveedores distintos (`didit` titular, `textract` acompañantes).
 *
 * Cubre las 8 automatizaciones posibles, pero `/automation-status` solo
 * devuelve las que la propiedad tiene configuradas (una respuesta real trajo 6,
 * sin Smart Lock ni TRA) — no asumir que llegan todas.
 */
const DEFINITION_ID_BY_AUTOMATION_NAME: Record<string, string> = {
    "identity verification - main guest": "identity-verification-main",
    "identity verification - secondary guest": "identity-verification-secondary",
    "identity verification - secondary guests": "identity-verification-secondary",
    "digital contract": "digital-contract",
    "smart lock codes": "smart-lock-codes",
    "guest report pdf": "guest-report-pdf",
    "tra colombia": "tra-colombia",
    "sire colombia - check-in": "sire-colombia-checkin",
    "sire colombia - check-out": "sire-colombia-checkout",
}

/**
 * Los proveedores de firma se resuelven por slug y no por nombre: la fila de
 * firma es la única que puede llegar con dos proveedores distintos (`tufirma`
 * legacy o `hitguest_signature`) para la misma automatización, y el nombre que
 * manda el backend para ellas no siempre es "Digital Contract".
 *
 * El texto también sale de la definición canónica, no escrito a mano.
 */
export const AUTOMATION_TITLE_OVERRIDES: Record<string, string> = {
    tufirma: TITLE_BY_DEFINITION_ID["digital-contract"],
    hitguest_signature: TITLE_BY_DEFINITION_ID["digital-contract"],
}

/**
 * Resolves the title shown for an automation row: slug override first (product
 * naming), then the canonical definition title, then the raw backend name.
 */
export function automationTitle(providerSlug: string, automationName: string): string {
    const override = AUTOMATION_TITLE_OVERRIDES[providerSlug]
    if (override) return override
    // Solo el separador (guion CON espacios alrededor) se normaliza. Con `\s*`
    // el guion interno de "Check-in" también entraba y la clave salía
    // "sire colombia - check - in", que no cruzaba con el mapa.
    const key = automationName.trim().toLowerCase().replace(/\s+[–—-]\s+/g, " - ")
    const definitionId = DEFINITION_ID_BY_AUTOMATION_NAME[key]
    if (!definitionId) return automationName
    return TITLE_BY_DEFINITION_ID[definitionId] ?? automationName
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
    at_time_of_day: "Horario programado",
    on_physical_checkout: "Check-out físico",
    after_automation: "Tras otra automatización",
    on_main_guest_form_submitted: "Formulario del titular enviado",
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
