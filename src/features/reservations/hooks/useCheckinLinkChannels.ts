"use client"

import { useEffect, useState } from "react"
import { automationService } from "@/features/properties/services/automation-service"
import {
    DELIVERY_PROVIDERS,
    isCheckinLinkDeliveryAutomation,
    providerUnitCost,
    resolveEffectiveChannels,
    type ChannelUnitCosts,
    type DeliveryChannel,
} from "@/features/properties/lib/checkin-link-delivery"

export interface CheckinLinkChannelsState {
    /** Canales por los que sale el link de ESTA reserva. `["email"]` mientras no se sepa. */
    channels: DeliveryChannel[]
    /**
     * `true` solo cuando la respuesta viene de la configuración real. Sin
     * certeza no se muestra ningún aviso de canal: un fallo de red no puede
     * convertirse en «esta reserva no tiene teléfono» ni en «email de respaldo».
     */
    resolved: boolean
    /** Tarifa de cada canal cobrado; `null` = no se pudo leer. Decide el copy de cobro. */
    unitCosts: ChannelUnitCosts
}

const UNKNOWN_COSTS: ChannelUnitCosts = { whatsapp: null, ota_inbox: null }
const UNKNOWN: CheckinLinkChannelsState = { channels: ["email"], resolved: false, unitCosts: UNKNOWN_COSTS }

/**
 * El backend no expone los canales efectivos de una reserva (gap #4 del
 * contrato): se derivan de la automatización de la propiedad y del override de
 * la unidad con `resolveEffectiveChannels`, la misma tabla de verdad que usa la
 * pestaña de Automatizaciones.
 *
 * Tarifas: WhatsApp sale del provider de la fila (sideloaded); OTA de su propio
 * provider (§13.2), que se busca solo si el canal está activo. Un fallo al
 * leer una tarifa deja esa tarifa en `null` sin tumbar los canales.
 */
export function useCheckinLinkChannels(
    propertyUuid: string | null | undefined,
    listingUuid: string | null | undefined,
): CheckinLinkChannelsState {
    const [state, setState] = useState<CheckinLinkChannelsState>(UNKNOWN)

    useEffect(() => {
        let active = true
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(UNKNOWN)
        if (!propertyUuid) return

        const resolve = async () => {
            // `includeProvider` para leer la tarifa; el provider llega sanitizado.
            const automations = await automationService.list(propertyUuid, { includeProvider: true })
            const automation = automations.find(isCheckinLinkDeliveryAutomation) ?? null
            let override = null
            if (automation && listingUuid) {
                const overrides = await automationService.listListingOverrides(listingUuid)
                override = overrides.find((o) => o.propertyAutomationUuid === automation.uuid) ?? null
            }
            const channels = resolveEffectiveChannels({ automation, override })
            const otaProvider = channels.includes("ota_inbox")
                ? await automationService
                    .findProviderBySlug(DELIVERY_PROVIDERS.ota_inbox.slug, DELIVERY_PROVIDERS.ota_inbox.nameHint)
                    .catch(() => null)
                : null
            if (active) {
                setState({
                    channels,
                    resolved: true,
                    unitCosts: {
                        whatsapp: providerUnitCost(automation?.provider),
                        ota_inbox: providerUnitCost(otaProvider),
                    },
                })
            }
        }
        resolve().catch(() => {
            // Se queda en UNKNOWN a propósito: ver el comentario de `resolved`.
        })

        return () => { active = false }
    }, [propertyUuid, listingUuid])

    return state
}
