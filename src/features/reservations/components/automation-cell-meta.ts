import type { AutomationStatus } from "@/types"
import type { StatusTone } from "@/components/ui/status-pill"

type LightState = AutomationStatus[keyof AutomationStatus]

/**
 * How each automation light reads in the Operaciones table.
 *
 * The wording is per-automation on purpose: a contract is "Firmado", an access
 * code is "Enviado", a check-in is "Completo". The previous table showed the
 * automation's NAME in every pill ("CONTRATO", "CÓDIGO") and left the state to
 * color alone — which is unreadable for a colorblind PM and says nothing to
 * anyone else. Here the column header names the automation and the pill says
 * what happened to it.
 */
const LABELS: Record<keyof AutomationStatus, Record<"success" | "pending", string>> = {
    link: { success: "Enviado", pending: "Pendiente" },
    checkin: { success: "Completo", pending: "En proceso" },
    contract: { success: "Firmado", pending: "Pendiente" },
    code: { success: "Enviado", pending: "Programado" },
    tra: { success: "Enviado", pending: "Pendiente" },
    sireIn: { success: "Enviado", pending: "Pendiente" },
    sireOut: { success: "Enviado", pending: "Pendiente" },
}

const TONES: Record<LightState, StatusTone> = {
    success: "success",
    pending: "warning",
    none: "none",
}

export interface AutomationCellMeta {
    tone: StatusTone
    label: string
}

/**
 * Resolve one light into the tone and wording its pill should show. A `none`
 * light returns the muted dash: the automation isn't configured for this
 * reservation, which is an absence, not a pending task.
 */
export function getAutomationCellMeta(
    key: keyof AutomationStatus,
    status: AutomationStatus | undefined,
): AutomationCellMeta {
    const state = status?.[key] ?? "none"
    if (state === "none") return { tone: "none", label: "—" }
    return { tone: TONES[state], label: LABELS[key][state] }
}

/**
 * Progreso de check-in de una reserva, para la columna CHECK-IN.
 *
 * `completed` es `null` cuando el backend no reportó el conteo. Es un estado
 * distinto de `0`: "no sabemos cuántos van" no es "no ha llegado ninguno", y
 * mostrar "0 de 3 verificados" cuando en realidad ya se registraron los tres
 * sería mentirle al operador. En ese caso se vuelve a la etiqueta binaria.
 */
export interface CheckinProgress {
    completed: number | null
    total: number
}

/**
 * La celda de CHECK-IN: "1 de 3 verificados" en vez de un "En proceso" que no
 * dice cuánto falta.
 *
 * Verde solo cuando están TODOS: mientras falte uno el ámbar sigue pidiendo
 * acción, que es justo lo que el operador necesita ver de un vistazo.
 *
 * Cae a la etiqueta binaria de siempre cuando no hay conteo utilizable, para
 * que una reserva sin el dato no muestre un progreso inventado.
 */
export function getCheckinCellMeta(
    status: AutomationStatus | undefined,
    progress?: CheckinProgress,
): AutomationCellMeta {
    const base = getAutomationCellMeta("checkin", status)

    // La automatización no está configurada: no hay nada cuyo progreso contar.
    if (base.tone === "none") return base

    const total = progress?.total ?? 0
    const completed = progress?.completed
    if (completed === null || completed === undefined || total <= 0) return base

    // Un backend que reporte 3 de 2 no debe pintar "3 de 2 verificados".
    const done = Math.min(Math.max(completed, 0), total)
    const noun = total === 1 ? "verificado" : "verificados"

    return {
        tone: done >= total ? "success" : "warning",
        label: `${done} de ${total} ${noun}`,
    }
}

/** The three reporting automations, in the order the Reportes column shows them. */
export const REPORT_LIGHTS: { key: keyof AutomationStatus; short: string }[] = [
    { key: "tra", short: "TRA" },
    { key: "sireIn", short: "SIRE in" },
    { key: "sireOut", short: "SIRE out" },
]
