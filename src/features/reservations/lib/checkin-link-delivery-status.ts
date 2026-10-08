/**
 * Qué pasó con el link de check-in de una reserva, por canal — contrato del
 * 2026-09-19 §6 (skill `hitguest-api-contracts` §1, «Envío del link»).
 *
 * Todo sale de `extra` del `GET /reservations/{uuid}` y es de LECTURA para
 * mostrar: nada gatea acciones. Por eso la dirección de fallo es la de un
 * aviso: una clave ausente no es noticia, y un estado que el backend no
 * documentó se muestra tal cual en tono neutro en vez de romper la ficha.
 *
 * `checkinLinkWhatsappMessageId` (el `wamid` de Meta) NO se lee a propósito:
 * el doc pide no mostrarlo, y no leerlo es la única forma de garantizarlo.
 */

import type { StatusTone } from "@/components/ui/status-pill"

export interface ChannelDelivery {
    /** ISO-8601 del último envío por este canal. */
    sentAt: string | null
    /** Dirección o número (E.164) al que salió. */
    to: string | null
    /** Estado crudo del backend; `null` si todavía no reportó nada. */
    status: string | null
    /** Motivo, solo cuando falló. */
    reason: string | null
    /** Cuándo se supo el estado (solo WhatsApp). */
    statusAt: string | null
}

/**
 * Mensaje en la OTA (contrato 2026-09-27 §13.5). SIN estado de entrega: ni
 * Kunas ni Calry avisan si el huésped lo leyó. `checkinLinkOtaMessageId` no se
 * lee a propósito (id interno del PMS, no se muestra).
 */
export interface OtaDelivery {
    sentAt: string
    /** Slug de la integración por la que salió (`kunas_pms`, `calry`); `null` si no vino. */
    via: string | null
}

export interface CheckinLinkDeliveryStatus {
    /** `null` = nunca salió por email. */
    email: ChannelDelivery | null
    /** `null` = nunca salió por WhatsApp. */
    whatsapp: ChannelDelivery | null
    /** `null` = nunca se publicó en la OTA. */
    ota: OtaDelivery | null
}

const EMPTY: CheckinLinkDeliveryStatus = Object.freeze({ email: null, whatsapp: null, ota: null })

/** Integraciones por las que el canal OTA puede publicar (§13.1). */
const OTA_CAPABLE_SOURCES: ReadonlySet<string> = new Set(["kunas_pms", "calry"])

/**
 * ¿Aplica el mensaje en la OTA a esta reserva? (§13.5) Solo a las importadas de
 * Kunas o Calry; en una manual o de iCal cae a email en silencio. `null` = no
 * se sabe (backend sin `isImported`): sin certeza no se avisa nada.
 */
export function isOtaApplicable(origin: { originKnown: boolean; importSource: string | null }): boolean | null {
    if (!origin.originKnown) return null
    return origin.importSource != null && OTA_CAPABLE_SOURCES.has(origin.importSource)
}

/**
 * Lo que el backend acepta como teléfono (§7): entre 7 y 15 dígitos; él
 * completa el indicativo con el país de la propiedad. Un string cualquiera no
 * alcanza: el campo de teléfono deja solo el prefijo (`+57`) al vaciarse, y
 * con eso la UI prometía WhatsApp mientras el backend lo omitía por inusable.
 */
export function hasUsablePhone(phone: string | null | undefined): boolean {
    if (typeof phone !== "string") return false
    const digits = phone.replace(/\D/g, "").length
    return digits >= 7 && digits <= 15
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Primera clave con string no vacío, tolerando camelCase y snake_case. */
function readString(extra: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
        const value = extra[key]
        if (typeof value === "string" && value.trim() !== "") return value
    }
    return null
}

export function readCheckinLinkDelivery(extra: unknown): CheckinLinkDeliveryStatus {
    const record = asRecord(extra)
    if (!record) return EMPTY

    const emailSentAt = readString(record, "checkinLinkSentAt", "checkin_link_sent_at")
    const emailStatus = readString(record, "mailDeliveryStatus", "mail_delivery_status")
    const email: ChannelDelivery | null = emailSentAt || emailStatus
        ? {
            sentAt: emailSentAt,
            to: readString(record, "checkinLinkSentTo", "checkin_link_sent_to"),
            status: emailStatus,
            reason: readString(record, "mailDeliveryReason", "mail_delivery_reason"),
            statusAt: null,
        }
        : null

    const whatsappSentAt = readString(record, "checkinLinkWhatsappSentAt", "checkin_link_whatsapp_sent_at")
    const whatsappStatus = readString(record, "whatsappDeliveryStatus", "whatsapp_delivery_status")
    const whatsapp: ChannelDelivery | null = whatsappSentAt || whatsappStatus
        ? {
            sentAt: whatsappSentAt,
            // El doc del 2026-09-19 escribe `checkinLinkWhatsappTo`; el de email es
            // `checkinLinkSentTo`. Como WhatsApp no está verificado por curl y el
            // nombre es inconsistente, se aceptan las dos formas (y snake_case).
            to: readString(
                record,
                "checkinLinkWhatsappTo",
                "checkinLinkWhatsappSentTo",
                "checkin_link_whatsapp_to",
                "checkin_link_whatsapp_sent_to",
            ),
            status: whatsappStatus,
            reason: readString(record, "whatsappDeliveryReason", "whatsapp_delivery_reason"),
            statusAt: readString(record, "whatsappDeliveryStatusAt", "whatsapp_delivery_status_at"),
        }
        : null

    const otaSentAt = readString(record, "checkinLinkOtaSentAt", "checkin_link_ota_sent_at")
    const ota: OtaDelivery | null = otaSentAt
        ? { sentAt: otaSentAt, via: readString(record, "checkinLinkOtaVia", "checkin_link_ota_via") }
        : null

    return { email, whatsapp, ota }
}

export interface DeliveryStatusMeta {
    label: string
    tone: StatusTone
    /** Línea secundaria: el motivo del fallo y, en WhatsApp, que no se cobró. */
    detail: string | null
}

/** Tabla de §6 para WhatsApp. Un `failed` ya fue reembolsado por el backend: se dice, no se reclama. */
export function whatsappStatusMeta(delivery: ChannelDelivery): DeliveryStatusMeta {
    switch (delivery.status) {
        case null:
        case "sent":
            return { label: "Enviado", tone: "idle", detail: null }
        case "delivered":
            return { label: "Entregado", tone: "success", detail: null }
        case "read":
            return { label: "Leído", tone: "success", detail: null }
        case "failed":
            return {
                label: "No se pudo entregar",
                tone: "danger",
                detail: [delivery.reason, "No se cobró este mensaje."].filter(Boolean).join(" · "),
            }
        default:
            return { label: delivery.status, tone: "idle", detail: null }
    }
}

/** Estados del webhook de Mailgun (`delivered · failed · complained`). */
export function mailStatusMeta(delivery: ChannelDelivery): DeliveryStatusMeta {
    switch (delivery.status) {
        case null:
            return { label: "Enviado", tone: "idle", detail: null }
        case "delivered":
            return { label: "Entregado", tone: "success", detail: null }
        case "failed":
            return { label: "No se pudo entregar", tone: "danger", detail: delivery.reason }
        case "complained":
            return { label: "Marcado como spam", tone: "warning", detail: null }
        default:
            return { label: delivery.status, tone: "idle", detail: null }
    }
}
