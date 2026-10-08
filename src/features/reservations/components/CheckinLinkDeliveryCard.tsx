"use client"

import type { ComponentType } from "react"
import { Mail, MessageCircle, MessagesSquare, AlertTriangle, Info, Phone } from "lucide-react"
import { format, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { SectionCard } from "@/components/ui/section-card"
import { StatusPill } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
import {
    CHANNEL_LABEL,
    describeChannels,
    isEmailFallback,
    type DeliveryChannel,
} from "@/features/properties/lib/checkin-link-delivery"
import {
    hasUsablePhone,
    isOtaApplicable,
    mailStatusMeta,
    whatsappStatusMeta,
    type ChannelDelivery,
    type CheckinLinkDeliveryStatus,
    type DeliveryStatusMeta,
} from "../lib/checkin-link-delivery-status"
import { importSourceLabel, type ReservationOrigin } from "../lib/reservation-origin"
import { ReservationDialog } from "./ReservationDialog"

interface Props {
    reservationUuid: string
    delivery: CheckinLinkDeliveryStatus
    channels: DeliveryChannel[]
    /** `false` = no se pudo resolver la configuración: no se afirma nada sobre los canales. */
    channelsResolved: boolean
    phone?: string
    /** Decide si el mensaje en la OTA aplica a esta reserva (§13.5). */
    origin: Pick<ReservationOrigin, "originKnown" | "importSource">
}

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>

function formatSentAt(iso: string | null): string | null {
    if (!iso) return null
    const date = new Date(iso)
    return isValid(date) ? format(date, "d MMM, HH:mm", { locale: es }) : null
}

/**
 * Pantalla 3 del contrato (§6, §7 y §13.5): por dónde salió el link y si
 * llegó, más los avisos que hacen visible lo que el backend hace en silencio —
 * WhatsApp sin teléfono, o mensaje en la OTA en una reserva que no vino de un
 * PMS: en los dos casos el link sale por email y el PM puede creer lo contrario.
 */
export function CheckinLinkDeliveryCard({
    reservationUuid,
    delivery,
    channels,
    channelsResolved,
    phone,
    origin,
}: Props) {
    const missingPhone = channelsResolved && channels.includes("whatsapp") && !hasUsablePhone(phone)
    const otaNotApplicable = channelsResolved && channels.includes("ota_inbox") && isOtaApplicable(origin) === false
    // §13.7: email que salió sin estar entre los canales = respaldo tardío.
    const emailLabel = channelsResolved && isEmailFallback(channels) ? "Email (respaldo)" : CHANNEL_LABEL.email
    const nothingSent = !delivery.email && !delivery.whatsapp && !delivery.ota

    return (
        <SectionCard
            title="Link de check-in"
            description={channelsResolved ? `Configurado: ${describeChannels(channels)}` : undefined}
        >
            <div className="space-y-4">
                {nothingSent ? (
                    <p className="text-sm text-ink-3">Todavía no se ha enviado.</p>
                ) : (
                    <dl className="space-y-3">
                        {delivery.email && (
                            <ChannelRow icon={Mail} label={emailLabel} to={delivery.email.to} when={whenOf(delivery.email)} meta={mailStatusMeta(delivery.email)} />
                        )}
                        {delivery.whatsapp && (
                            <ChannelRow icon={MessageCircle} label={CHANNEL_LABEL.whatsapp} to={delivery.whatsapp.to} when={whenOf(delivery.whatsapp)} meta={whatsappStatusMeta(delivery.whatsapp)} />
                        )}
                        {delivery.ota && (
                            // Sin estado de entrega: ni Kunas ni Calry avisan si se leyó.
                            <ChannelRow
                                icon={MessagesSquare}
                                label={CHANNEL_LABEL.ota_inbox}
                                to={delivery.ota.via ? `Vía ${importSourceLabel(delivery.ota.via)}` : null}
                                when={formatSentAt(delivery.ota.sentAt)}
                                meta={{ label: "Enviado", tone: "idle", detail: null }}
                            />
                        )}
                    </dl>
                )}

                {missingPhone && (
                    <div className="flex flex-col gap-3 rounded-lg bg-warning-sunk px-3 py-2.5 text-xs text-warning sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-start gap-2">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                            {phone
                                ? "El teléfono de esta reserva no es utilizable. El link no saldrá por WhatsApp."
                                : "Esta reserva no tiene teléfono. El link no saldrá por WhatsApp."}
                        </p>
                        {/* El diálogo emite `reservationCreated` también al editar; la
                            ficha lo escucha y se recarga sola. */}
                        <ReservationDialog
                            mode="edit"
                            reservationUuid={reservationUuid}
                            trigger={
                                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                                    <Phone size={13} aria-hidden /> {phone ? "Corregir teléfono" : "Agregar teléfono"}
                                </Button>
                            }
                        />
                    </div>
                )}

                {otaNotApplicable && (
                    <p className="flex items-start gap-2 rounded-lg bg-info-sunk px-3 py-2.5 text-xs text-info">
                        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
                        Esta reserva no vino de un PMS: el mensaje en la OTA no aplica y el link sale por email.
                    </p>
                )}
            </div>
        </SectionCard>
    )
}

function whenOf(delivery: ChannelDelivery): string | null {
    return formatSentAt(delivery.statusAt ?? delivery.sentAt)
}

function ChannelRow({
    icon: Icon,
    label,
    to,
    when,
    meta,
}: {
    icon: IconType
    label: string
    to: string | null
    when: string | null
    meta: DeliveryStatusMeta
}) {
    return (
        <div className="flex items-start gap-3">
            <Icon size={16} className="mt-0.5 shrink-0 text-ink-4" aria-hidden />
            <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium text-ink-3">{label}</dt>
                <dd className="mt-0.5 space-y-1">
                    {to && <p className="truncate text-sm font-semibold text-ink">{to}</p>}
                    <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                        {when && <span>{when}</span>}
                    </p>
                    {meta.detail && <p className="text-xs text-ink-3">{meta.detail}</p>}
                </dd>
            </div>
        </div>
    )
}
