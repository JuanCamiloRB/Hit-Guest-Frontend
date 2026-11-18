/**
 * Lo que la reserva NO dice del envío del link: los canales que se saltaron y
 * por qué (sin teléfono, WhatsApp no habilitado, sin conversación en la OTA…).
 * El backend lo deja solo en el historial de ejecuciones
 * (`GET /reservations/{uuid}/automation-records`, registros de
 * `whatsapp_checkin_link` con `responsePayload.channel` y `skipped`), no en el
 * `extra` de la reserva. Puro: la carga perezosa va en `useLinkAttempts`.
 */

import type { AutomationUsageRecord } from "@/features/properties/types/automation"
import { canonicalSlug } from "@/features/properties/services/automation-service"
import type { CheckinLinkDeliveryStatus } from "./checkin-link-delivery-status"
import { errorMessage } from "../components/automations/automation-status-meta"
import { formatMoment, type CellState, type DetailLine } from "./automation-cells"
import { skippedReasonShort } from "./skipped-reasons"

export type AttemptChannel = "whatsapp" | "ota_inbox"

export interface LinkAttempt {
    channel: AttemptChannel
    outcome: "skipped" | "failed" | "completed" | "pending"
    /** Motivo legible del salto o del fallo; `null` si no se informó o no se puede traducir. */
    reason: string | null
    at: string | null
}

const LINK_SLUG = "whatsapp_checkin_link"
const NAME: Record<AttemptChannel, string> = { whatsapp: "WhatsApp", ota_inbox: "Mensaje en la OTA" }

/**
 * El intento más reciente por canal. Los registros llegan del más nuevo al más
 * viejo; uno sin `channel` es de antes del tercer canal, cuando solo existía
 * WhatsApp.
 */
export function latestLinkAttempts(records: readonly AutomationUsageRecord[]): Partial<Record<AttemptChannel, LinkAttempt>> {
    const latest: Partial<Record<AttemptChannel, LinkAttempt>> = {}
    for (const record of records) {
        if (canonicalSlug(record.providerSlug ?? "") !== LINK_SLUG) continue
        const channel: AttemptChannel = record.channel ?? "whatsapp"
        if (latest[channel]) continue
        const payload = record.responsePayload ?? {}
        const skipped = payload.skipped === true
        const reasonCode = typeof payload.reason === "string" ? payload.reason : null
        const failure = record.status === "failed" ? errorMessage(record.lastError) : null
        latest[channel] = {
            channel,
            outcome: skipped ? "skipped" : record.status,
            reason: skipped ? skippedReasonShort(reasonCode) : failure && /\s/.test(failure) ? failure : null,
            at: record.updatedAt || record.createdAt || null,
        }
    }
    return latest
}

/**
 * Las líneas que el historial AGREGA al detalle: solo los canales que no
 * aparecen en el envío de la reserva (lo de la reserva trae el estado de
 * entrega, que es más preciso). Un canal saltado no es un fallo: no se cobró y
 * el correo salió igual; se dice por qué.
 */
export function attemptLines(
    attempts: Partial<Record<AttemptChannel, LinkAttempt>>,
    delivery: CheckinLinkDeliveryStatus | undefined,
): DetailLine[] {
    const lines: DetailLine[] = []
    for (const channel of ["whatsapp", "ota_inbox"] as const) {
        const attempt = attempts[channel]
        if (!attempt) continue
        if (channel === "whatsapp" && delivery?.whatsapp) continue
        if (channel === "ota_inbox" && delivery?.ota) continue
        const when = formatMoment(attempt.at)
        const at = when ? ` · ${when}` : ""
        const state: CellState = attempt.outcome === "skipped" ? "none"
            : attempt.outcome === "failed" ? "failed"
                : attempt.outcome === "pending" ? "pending" : "success"
        const verb = attempt.outcome === "skipped" ? (channel === "ota_inbox" ? "no se publicó" : "no se envió")
            : attempt.outcome === "failed" ? "falló"
                : attempt.outcome === "pending" ? "en proceso"
                    : channel === "ota_inbox" ? "publicado" : "enviado"
        const why = attempt.reason ? `: ${attempt.reason}` : attempt.outcome === "skipped" ? " (motivo no informado)" : ""
        lines.push({ state, text: `${NAME[channel]} · ${verb}${at}${why}` })
    }
    return lines
}
