"use client"

import { useState } from "react"
import { MessageCircle, Loader2, Info } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { automationService } from "../../services/automation-service"
import { AUTOMATION_STATUS, type PropertyAutomation, type Provider, type ProviderBilling } from "../../types/automation"
import {
    CHANNEL_LABEL,
    buildChannels,
    buildCheckinLinkDeliveryCreatePayload,
    describeChannelCost,
    describeChannels,
    optionalChannelsOf,
    providerBilling,
    readChannelErrors,
    readDeliveryChannels,
    sameChannelSet,
    type OptionalDeliveryChannel,
} from "../../lib/checkin-link-delivery"
import { CHECKIN_LINK_DELIVERY_TITLE } from "../../lib/automation-display"
import { CheckinLinkDeliveryOverrides } from "./CheckinLinkDeliveryOverrides"
import type { ListingMeta } from "./AutomationOverrideModal"
import { FeedbackBanner } from "@/components/ui/feedback-banner"

interface Props {
    propertyUuid: string
    /** `null` = la propiedad todavía no tiene la fila: el link sale por email (comportamiento histórico). */
    automation: PropertyAutomation | null
    /**
     * `whatsapp`: el provider de la FILA — sin él no se puede crear la primera
     * vez. `ota_inbox`: solo aporta la tarifa del canal OTA (§13.2).
     */
    providers: { whatsapp: Provider | null; ota_inbox: Provider | null }
    /** Pista §13.3: la propiedad tiene identificadores de PMS (Kunas/Calry). */
    pmsConnected: boolean
    /** Todas las filas de la propiedad, para elegir un `executionOrder` fuera del rango de identidad. */
    existingAutomations: PropertyAutomation[]
    listings: ListingMeta[]
    onChanged: (updated: PropertyAutomation) => void
}

const NO_CHANNELS: ReadonlySet<OptionalDeliveryChannel> = new Set()

/**
 * Pantalla 1 del contrato (§4 + §13): cómo le llega el link al huésped.
 *
 * Tarjeta propia y no una `AutomationCard` genérica a propósito: aquella exige
 * disparadores y abre el modal de credenciales al activar, y esta
 * automatización no tiene ni lo uno ni lo otro — solo canales. El email va
 * siempre (decisión de producto en `buildChannels`); se eligen WhatsApp y el
 * mensaje en la OTA.
 */
export function CheckinLinkDeliveryCard({
    propertyUuid,
    automation,
    providers,
    pmsConnected,
    existingAutomations,
    listings,
    onChanged,
}: Props) {
    const storedChannels = readDeliveryChannels(automation?.parameters)
    // Lo que el backend usa HOY: una fila inactiva equivale a «solo email».
    const persisted = automation?.isActive ? optionalChannelsOf(storedChannels) : NO_CHANNELS
    // Borrador local: `null` = sin cambios respecto a lo persistido.
    const [draft, setDraft] = useState<Set<OptionalDeliveryChannel> | null>(null)
    const [saving, setSaving] = useState(false)
    const [channelErrors, setChannelErrors] = useState<string[]>([])

    const selected: ReadonlySet<OptionalDeliveryChannel> = draft ?? persisted
    const dirty = draft != null && !sameChannelSet(draft, persisted)
    // Sin fila y sin el provider de WhatsApp no hay con qué crearla.
    const canConfigure = automation != null || providers.whatsapp != null
    // §13.3: la casilla de OTA se ofrece con la pista de PMS. Si ya estaba
    // guardada (o elegida) sin pista, se muestra igual para poder retirarla:
    // nunca se oculta lo que el backend tiene.
    const showOta = pmsConnected || storedChannels.includes("ota_inbox") || selected.has("ota_inbox")
    const otaWithoutPms = selected.has("ota_inbox") && !pmsConnected

    const toggle = (channel: OptionalDeliveryChannel, checked: boolean) => {
        const next = new Set(selected)
        if (checked) next.add(channel)
        else next.delete(channel)
        setDraft(next)
        setChannelErrors([])
    }

    // Solo lo usa un onClick: sin memoizar (el compilador de React no puede
    // preservar un useCallback con estas dependencias y tampoco aporta nada).
    const handleSave = async () => {
        if (!propertyUuid || !dirty || !draft) return
        setSaving(true)
        setChannelErrors([])
        let createdTarget: PropertyAutomation | null = null
        try {
            let target = automation
            if (!target) {
                if (!providers.whatsapp) throw new Error("El proveedor del envío del link no está disponible.")
                // Paso 1 (§3.3): la fila nace inactiva y vacía; los canales se
                // validan solo en `configure`.
                target = await automationService.create(
                    buildCheckinLinkDeliveryCreatePayload(propertyUuid, providers.whatsapp, existingAutomations),
                )
                createdTarget = target
            }
            // Paso 2 (§3.4): configurar y activar en la misma llamada. Dejar solo
            // email es válido y equivale a apagar los demás canales.
            const channels = buildChannels(draft)
            const result = await automationService.configure(target.uuid, {
                statusProviderId: AUTOMATION_STATUS.ACTIVE,
                parameters: { channels },
            })
            onChanged({
                ...result,
                provider: result.provider ?? target.provider,
                providerName: result.providerName ?? target.providerName,
            })
            setDraft(null)
            toast.success(`El link saldrá por: ${describeChannels(channels).toLowerCase()}`)
        } catch (err) {
            // El POST ya pudo crear la fila aunque falle la configuración: se
            // retiene para que el próximo intento no cree otra.
            if (createdTarget) onChanged(createdTarget)
            // 422 de canales (§3.4, §13.3): mensaje ya traducido, junto a las casillas.
            const messages = err instanceof ApiError ? readChannelErrors(err.errors) : []
            if (messages.length > 0) {
                setChannelErrors(messages)
                return
            }
            if (!createdTarget && !automation && err instanceof ApiError && err.status === 403) {
                // Contradicción abierta del skill: `POST /property-automations`
                // respondía 403 al PM. Si sigue así, el flujo no existe y hay que
                // decirlo, no disfrazarlo de error genérico.
                toast.error(
                    "Tu cuenta no puede crear esta automatización todavía. Pídele al equipo de HIT que la habilite; mientras tanto el link sigue saliendo por email.",
                    { duration: 8000 },
                )
                return
            }
            notifyError(err, "No se pudo guardar el envío del link de check-in")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="group overflow-hidden border-rule/60 transition-all duration-300 hover:border-primary/30 hover:shadow-md">
            <CardContent className="p-0">
                <div className="flex flex-col items-stretch md:flex-row">
                    {/* Columna de ícono como las demás automatizaciones: el verde es solo para estado. */}
                    <div className="flex w-full items-center justify-center bg-primary/5 py-4 md:w-20 md:py-0">
                        <MessageCircle className="h-8 w-8 text-primary" />
                    </div>

                    <div className="flex-1 space-y-4 p-5">
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-bold leading-none text-ink">
                                    {CHECKIN_LINK_DELIVERY_TITLE}
                                </h3>
                                {automation?.isActive && (
                                    <Badge variant="outline" className="h-5 border-success/30 bg-success-sunk text-xs font-bold uppercase tracking-wider text-success">
                                        Activo
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm leading-relaxed text-ink-3">
                                Cómo le llega al huésped el link para hacer su check-in. El email va siempre y no
                                tiene costo; los demás canales son opcionales.
                            </p>
                        </div>

                        <fieldset className="space-y-3" disabled={saving || !canConfigure}>
                            <legend className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                                ¿Cómo le llega el link al huésped?
                            </legend>

                            <div className="flex items-center gap-3">
                                <Checkbox id="checkin-link-email" checked disabled aria-readonly />
                                <Label htmlFor="checkin-link-email" className="flex flex-1 items-center justify-between gap-3 font-medium text-ink-2">
                                    <span>{CHANNEL_LABEL.email}</span>{" "}
                                    <span className="text-xs font-normal text-ink-3">Incluido siempre</span>
                                </Label>
                            </div>

                            <ChannelOption
                                channel="whatsapp"
                                checked={selected.has("whatsapp")}
                                billing={providerBilling(providers.whatsapp)}
                                onChange={toggle}
                            />
                            {showOta && (
                                <ChannelOption
                                    channel="ota_inbox"
                                    checked={selected.has("ota_inbox")}
                                    billing={providerBilling(providers.ota_inbox)}
                                    onChange={toggle}
                                />
                            )}
                        </fieldset>

                        {otaWithoutPms && (
                            <FeedbackBanner tone="warning" mode="dynamic" density="compact">
                                Esta propiedad no tiene registrada una integración con Kunas o Calry: el mensaje en la
                                OTA no se podrá enviar. Desmárcalo para dejar de usarlo.
                            </FeedbackBanner>
                        )}
                        {channelErrors.length > 0 && (
                            <FeedbackBanner tone="danger" mode="blocking" density="compact" className="[&_[data-slot=feedback-banner-description]]:space-y-1">
                                {channelErrors.map((message) => <p key={message}>{message}</p>)}
                            </FeedbackBanner>
                        )}

                        <p className="flex items-start gap-2 text-xs text-ink-3">
                            <Info size={14} className="mt-0.5 shrink-0 text-ink-3" />
                            Si un canal no aplica a una reserva (sin teléfono, o sin conversación en la OTA), el link le
                            llega por email de todas formas.
                        </p>

                        {!canConfigure && (
                            <FeedbackBanner tone="info" density="compact">
                                Los canales adicionales todavía no están habilitados en tu cuenta. Mientras tanto el link
                                sale solo por email.
                            </FeedbackBanner>
                        )}

                        <div className="flex items-center justify-end border-t border-rule pt-3">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleSave()}
                                disabled={!dirty || saving || !canConfigure}
                                className="gap-2 bg-primary text-white hover:bg-primary/90"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Guardar
                            </Button>
                        </div>

                        {automation?.isActive && listings.length > 0 && (
                            /* `key`: al cambiar de fila/propiedad se descarta el estado por unidad. */
                            <CheckinLinkDeliveryOverrides
                                key={automation.uuid}
                                automation={automation}
                                listings={listings}
                                pmsConnected={pmsConnected}
                            />
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function ChannelOption({
    channel,
    checked,
    billing,
    onChange,
}: {
    channel: OptionalDeliveryChannel
    checked: boolean
    billing: ProviderBilling | null
    onChange: (channel: OptionalDeliveryChannel, checked: boolean) => void
}) {
    const id = `checkin-link-${channel}`
    return (
        <div className="flex items-center gap-3">
            <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(channel, value === true)} />
            <Label htmlFor={id} className="flex flex-1 items-center justify-between gap-3 font-medium text-ink-2">
                {/* El espacio separa canal y tarifa en el nombre accesible
                    («WhatsApp 0,10 USD…», no «WhatsApp0,10 USD…»). */}
                <span>{CHANNEL_LABEL[channel]}</span>{" "}
                <span className="text-xs font-normal text-ink-3">{describeChannelCost(billing)}</span>
            </Label>
        </div>
    )
}
