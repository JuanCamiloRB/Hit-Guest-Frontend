/**
 * Cómo se presenta una automatización ante el PM: nunca el `name` del backend
 * («Digital Signature for Contract») ni el slug del proveedor (`didit`) como
 * etiqueta. Solo presentación: el slug sigue siendo la clave para esquemas,
 * selección de proveedores y llamadas al backend.
 *
 * El título sale del `title` de `automation-definitions` (el mismo de la
 * pantalla de Automatizaciones); el detalle, del nombre del proveedor en la DB
 * (pedido de Didier y Ricardo, 2026-10-27/29: la unidad mostraba los slugs).
 */

import { definitionForAutomation } from "../data/automation-definitions"
import type { ListingAutomationOverride, PropertyAutomation } from "../types/automation"
import { describeChannels, isCheckinLinkDeliveryAutomation, resolveEffectiveChannels } from "./checkin-link-delivery"
import { isIdentityPropertyAutomation } from "./identity-listing-override"
import { providerLabel } from "./provider-labels"

/** El título de la tarjeta propia del envío del link (no está en las definiciones). */
export const CHECKIN_LINK_DELIVERY_TITLE = "Envío del link de check-in"

export interface AutomationDisplay {
    title: string
    /** El nombre del proveedor que se ejecuta (badge); `null` = nada que mostrar. */
    detail: string | null
    /**
     * Solo en el envío del link: sus canales EFECTIVOS («Email y WhatsApp»).
     * Va junto a la descripción: el badge dice el proveedor (WhatsApp) y sin
     * esto parecería el único canal.
     */
    channels: string | null
}

export function automationTitle(automation: PropertyAutomation): string {
    if (isCheckinLinkDeliveryAutomation(automation)) return CHECKIN_LINK_DELIVERY_TITLE
    return definitionForAutomation(automation).title
}

/**
 * Título y detalle de una automatización, para una unidad si se pasa su override.
 *
 * El detalle es el `name` del proveedor, que se edita desde la DB (pedido de
 * Ricardo, 2026-10-29: «colocá el nombre del Provider»). El de la unidad cuando
 * su override informa `effectiveProvider` —lo que REALMENTE ejecuta; `null` =
 * nada—; si no, el de la propiedad. Sin `name` legible, el de las
 * definiciones; si tampoco hay, «Proveedor configurado». El slug nunca llega a
 * la pantalla, ni siquiera como tooltip: es solo para front y back.
 */
export function automationDisplay(
    automation: PropertyAutomation,
    override: ListingAutomationOverride | null = null,
): AutomationDisplay {
    const delivery = isCheckinLinkDeliveryAutomation(automation)
    const channels = delivery ? describeChannels(resolveEffectiveChannels({ automation, override })) : null
    const title = delivery ? CHECKIN_LINK_DELIVERY_TITLE : definitionForAutomation(automation).title

    // Solo el override de IDENTIDAD informa qué ejecuta la unidad (contrato
    // 2026-10-14), y solo si el campo vino: ausente no es «nada».
    if (override && override.effectiveProvider !== undefined && isIdentityPropertyAutomation(automation)) {
        const effective = override.effectiveProvider
        if (effective === null) return { title, detail: null, channels }
        return { title, detail: readableName(effective.name, effective.slug) ?? providerLabel(effective.slug) ?? "Proveedor configurado", channels }
    }

    const slug = automation.provider?.parameters?.slug ?? automation.providerName ?? null
    const detail = readableName(automation.provider?.name, slug)
        ?? providerLabel(slug)
        ?? (slug || automation.provider ? "Proveedor configurado" : null)
    return { title, detail, channels }
}

/** Un `name` vacío o igual al slug no es un nombre para el PM. */
function readableName(name: string | null | undefined, slug: string | null | undefined): string | null {
    const trimmed = name?.trim()
    return trimmed && trimmed !== slug ? trimmed : null
}
