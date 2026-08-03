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

/** The three reporting automations, in the order the Reportes column shows them. */
export const REPORT_LIGHTS: { key: keyof AutomationStatus; short: string }[] = [
    { key: "tra", short: "TRA" },
    { key: "sireIn", short: "SIRE in" },
    { key: "sireOut", short: "SIRE out" },
]
