/**
 * Envío del link de check-in — contrato del 2026-09-19 + addendum 2026-09-27
 * (skill `hitguest-api-contracts` §1, «Envío del link de check-in»).
 *
 * Sin React ni fetch: acá vive la tabla de verdad de canales, la identificación
 * del provider/fila, las etiquetas y el payload de creación. La tarjeta de la
 * propiedad, la lista por unidad, el detalle de la reserva, el reenvío y el
 * historial consumen esto, para que no puedan divergir en qué significa
 * «canales efectivos» ni en cómo se llama cada canal.
 *
 * Regla del contrato que ordena todo: **el backend nunca resuelve a una lista
 * vacía.** Sin automatización, inactiva, override inactivo o `channels` vacío
 * ⇒ `["email"]`. La UI no promete un canal como garantía: sin teléfono no sale
 * WhatsApp, y sin PMS no sale el mensaje en la OTA; el email sale igual.
 */

import { formatUsdRate } from "@/features/billing/types"
import { canonicalSlug } from "../services/automation-service"
import {
    AUTOMATION_STATUS,
    type ListingAutomationOverride,
    type PropertyAutomation,
    type PropertyAutomationCreatePayload,
    type Provider,
} from "../types/automation"

// ── Identidad de la automatización y sus providers ─────────────────────────

/** `automationType` de la fila (§3.2). Señal primaria para detectarla. */
export const CHECKIN_LINK_DELIVERY_AUTOMATION_TYPE = "checkin_link_delivery"

/**
 * Providers relacionados, siempre por `parameters.slug`, nunca por nombre ni id.
 * La FILA de la automatización usa el de WhatsApp para los dos canales cobrados;
 * el de OTA existe solo para leer su tarifa (§13.2) y no es una automatización.
 * `nameHint` es solo el término de búsqueda `name[has]`, nunca un criterio.
 */
export const DELIVERY_PROVIDERS = {
    whatsapp: { slug: "whatsapp_checkin_link", nameHint: "WhatsApp" },
    ota_inbox: { slug: "ota_inbox_checkin_link", nameHint: "OTA Inbox" },
} as const

/** El provider de la fila de la automatización (el de WhatsApp). */
export const CHECKIN_LINK_DELIVERY_SLUG = DELIVERY_PROVIDERS.whatsapp.slug

const DELIVERY_PROVIDER_SLUGS: ReadonlySet<string> = new Set(
    Object.values(DELIVERY_PROVIDERS).map((provider) => provider.slug),
)

export function isCheckinLinkDeliveryProvider(provider: Provider): boolean {
    return canonicalSlug(provider.parameters?.slug) === CHECKIN_LINK_DELIVERY_SLUG
}

/** WhatsApp u OTA: los dos tienen tarjeta propia y no van al catálogo genérico. */
function isDeliveryRelatedProvider(provider: Provider): boolean {
    return DELIVERY_PROVIDER_SLUGS.has(canonicalSlug(provider.parameters?.slug))
}

/**
 * Detecta la fila por `automationType` (checklist §11) y, si el backend no lo
 * informa, por el slug de su provider — el criterio con el que se detectaba
 * antes del addendum.
 */
export function isCheckinLinkDeliveryAutomation(automation: PropertyAutomation): boolean {
    if (automation.automationType === CHECKIN_LINK_DELIVERY_AUTOMATION_TYPE) return true
    const slug = automation.provider?.parameters?.slug ?? automation.providerName
    return canonicalSlug(slug) === CHECKIN_LINK_DELIVERY_SLUG
}

export interface CheckinLinkDeliveryPartition {
    /** La fila de esta propiedad, si existe. */
    automation: PropertyAutomation | null
    /** Lo que sigue yendo al catálogo genérico de tarjetas. */
    rest: { automations: PropertyAutomation[]; providers: Provider[] }
}

/**
 * Separa esta automatización del catálogo genérico ANTES de construir las
 * tarjetas: tiene tarjeta propia, y dejarla también en el catálogo la pintaría
 * dos veces. Los providers de WhatsApp y OTA salen también: el de OTA no es
 * automatización y nunca debe ofrecerse como tarjeta. La fila del backend no
 * se oculta — la muestra la tarjeta dedicada.
 */
export function partitionCheckinLinkDelivery(
    automations: PropertyAutomation[],
    providers: Provider[],
): CheckinLinkDeliveryPartition {
    return {
        automation: automations.find(isCheckinLinkDeliveryAutomation) ?? null,
        rest: {
            automations: automations.filter((automation) => !isCheckinLinkDeliveryAutomation(automation)),
            providers: providers.filter((provider) => !isDeliveryRelatedProvider(provider)),
        },
    }
}

// ── Canales ────────────────────────────────────────────────────────────────

export type DeliveryChannel = "email" | "whatsapp" | "ota_inbox"
/** Los canales que el PM elige; el email va siempre (ver `buildChannels`). */
export type OptionalDeliveryChannel = Exclude<DeliveryChannel, "email">

/** Orden de presentación en toda la UI. */
const DELIVERY_CHANNELS: readonly DeliveryChannel[] = ["email", "whatsapp", "ota_inbox"]
const OPTIONAL_DELIVERY_CHANNELS: readonly OptionalDeliveryChannel[] = ["whatsapp", "ota_inbox"]

/** Nombre del canal cuando va solo (etiquetas, filas, columnas). */
export const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
    email: "Email",
    whatsapp: "WhatsApp",
    ota_inbox: "Mensaje en la OTA",
}

/** El mismo nombre dentro de una frase («email y WhatsApp»). */
const CHANNEL_INLINE_LABEL: Record<DeliveryChannel, string> = {
    email: "email",
    whatsapp: "WhatsApp",
    ota_inbox: "mensaje en la OTA",
}

const KNOWN_CHANNELS: ReadonlySet<string> = new Set<DeliveryChannel>(DELIVERY_CHANNELS)
const EMAIL_ONLY: readonly DeliveryChannel[] = ["email"]

/**
 * Lee `parameters.channels` tolerando lo que el backend admite y descartando lo
 * que no (§3.4 + §13.1: `email`, `whatsapp`, `ota_inbox`). Un valor
 * desconocido no revienta la pantalla ni se reenvía: simplemente no cuenta.
 */
export function readDeliveryChannels(parameters: Record<string, unknown> | null | undefined): DeliveryChannel[] {
    const raw = parameters?.channels
    if (!Array.isArray(raw)) return []
    const seen = new Set<DeliveryChannel>()
    for (const item of raw) {
        if (typeof item === "string" && KNOWN_CHANNELS.has(item)) seen.add(item as DeliveryChannel)
    }
    return DELIVERY_CHANNELS.filter((channel) => seen.has(channel))
}

/**
 * Tabla de verdad de §2, en el mismo orden del contrato. Es la ÚNICA forma
 * válida de responder «¿por dónde sale el link?» — el backend no expone los
 * canales efectivos ya resueltos (gap #4 del doc).
 */
export function resolveEffectiveChannels(input: {
    automation: PropertyAutomation | null
    override?: ListingAutomationOverride | null
}): DeliveryChannel[] {
    const { automation, override } = input
    if (!automation || !automation.isActive) return [...EMAIL_ONLY]

    if (override) {
        if (!override.isActive) return [...EMAIL_ONLY]
        // El merge es superficial: el `channels` del override REEMPLAZA entero
        // el de la propiedad. Así un listing puede quitar un canal.
        const overridden = readDeliveryChannels(override.parameters)
        return overridden.length > 0 ? overridden : [...EMAIL_ONLY]
    }

    const configured = readDeliveryChannels(automation.parameters)
    return configured.length > 0 ? configured : [...EMAIL_ONLY]
}

/**
 * Decisión de producto (pregunta 2 de §12, tomada en el front el 2026-09-22 y
 * mantenida con el addendum): el email va SIEMPRE y los demás canales son un
 * extra. Es gratis, cubre al huésped sin teléfono o sin OTA, y elimina el
 * estado «cero canales» que el doc pide bloquear.
 */
export function buildChannels(selected: Iterable<OptionalDeliveryChannel>): DeliveryChannel[] {
    const chosen = new Set(selected)
    return DELIVERY_CHANNELS.filter((channel) => channel === "email" || chosen.has(channel as OptionalDeliveryChannel))
}

/** Los canales opcionales presentes en una lista (para precargar casillas). */
export function optionalChannelsOf(channels: readonly DeliveryChannel[]): Set<OptionalDeliveryChannel> {
    return new Set(OPTIONAL_DELIVERY_CHANNELS.filter((channel) => channels.includes(channel)))
}

export function sameChannelSet(a: Iterable<OptionalDeliveryChannel>, b: Iterable<OptionalDeliveryChannel>): boolean {
    const left = new Set(a)
    const right = new Set(b)
    return left.size === right.size && [...left].every((channel) => right.has(channel))
}

/** «Solo email», «Email y WhatsApp», «Email, WhatsApp y mensaje en la OTA». */
export function describeChannels(channels: readonly DeliveryChannel[]): string {
    const ordered = DELIVERY_CHANNELS.filter((channel) => channels.includes(channel))
    if (ordered.length === 0) return "Solo email"
    if (ordered.length === 1) return `Solo ${CHANNEL_INLINE_LABEL[ordered[0]]}`
    const inline = ordered.map((channel) => CHANNEL_INLINE_LABEL[channel])
    const sentence = `${inline.slice(0, -1).join(", ")} y ${inline[inline.length - 1]}`
    return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/**
 * §13.7: el email puede salir aunque no esté entre los canales (respaldo tardío
 * cuando un canal cobrado falla). Solo se puede afirmar con la configuración
 * RESUELTA; y es la actual, no la del momento del envío — el front no la conoce.
 */
export function isEmailFallback(resolvedChannels: readonly DeliveryChannel[]): boolean {
    return !resolvedChannels.includes("email")
}

// ── Tarifas ────────────────────────────────────────────────────────────────

/** `parameters.billing.unit_cost` del provider; `null` si no vino. Nunca un valor inventado. */
export function providerUnitCost(provider: Provider | null | undefined): number | null {
    const cost = provider?.parameters?.billing?.unit_cost
    return typeof cost === "number" && Number.isFinite(cost) ? cost : null
}

/**
 * «Sin costo por ahora» mientras el provider salga con 0 (§9: la tarifa la fija
 * Finanzas con un UPDATE, sin despliegue). Un `0,00 USD` se lee como error.
 * Sin tarifa conocida no se afirma un cobro: «puede generar costo».
 */
export function describeChannelCost(unitCost: number | null): string {
    if (unitCost == null) return "Puede generar costo"
    if (unitCost === 0) return "Sin costo por ahora"
    return `${formatUsdRate(unitCost)} por mensaje`
}

/** Solo con una tarifa positiva se puede afirmar que el mensaje se cobra. */
export function isChargedCost(unitCost: number | null): boolean {
    return unitCost != null && unitCost > 0
}

export type ChannelUnitCosts = Record<OptionalDeliveryChannel, number | null>

/** La tarifa de un envío que no es seguro: se dice condicionada, nunca afirmada. */
function tentativeOtaCost(unitCost: number | null): string {
    if (unitCost == null) return "si sale, puede generar costo"
    if (unitCost === 0) return "si sale, hoy no tiene costo"
    return `si sale, cuesta ${formatUsdRate(unitCost)}`
}

/**
 * Qué decir antes de reenviar (§8 + §13.8): cada canal activo que de verdad va
 * a intentarse, con la certeza de su costo según la tarifa; y cada canal activo
 * que NO aplica a esta reserva, con el motivo. `null` = solo sale por email.
 *
 * `whatsappUsable`: la reserva tiene un teléfono utilizable.
 * `otaApplicable`: la reserva vino de Kunas o Calry; `null` = no se sabe — el
 * intento se anuncia condicionado («si la reserva lo permite»), sin afirmar
 * envío ni cobro.
 */
export function describeResendCharges(input: {
    channels: readonly DeliveryChannel[]
    whatsappUsable: boolean
    otaApplicable: boolean | null
    unitCosts: ChannelUnitCosts
}): string | null {
    const { channels, whatsappUsable, otaApplicable, unitCosts } = input
    const sentences: string[] = []
    const attempted: OptionalDeliveryChannel[] = []

    if (channels.includes("whatsapp")) {
        if (whatsappUsable) attempted.push("whatsapp")
        else sentences.push("WhatsApp no aplica: la reserva no tiene un teléfono utilizable.")
    }
    if (channels.includes("ota_inbox")) {
        if (otaApplicable === true) {
            attempted.push("ota_inbox")
        } else if (otaApplicable === false) {
            sentences.push("El mensaje en la OTA no aplica: la reserva no vino de Kunas ni Calry.")
        } else {
            // `null` = origen desconocido: no se afirma envío ni cobro — solo
            // que se intentará si la reserva lo permite (§13.5: en manual/iCal
            // el backend lo omite en silencio).
            sentences.push(
                `Se intentará el mensaje en la OTA solo si la reserva lo permite; ${tentativeOtaCost(unitCosts.ota_inbox)}.`,
            )
        }
    }

    if (attempted.length > 0) {
        const names = attempted.map((channel) => CHANNEL_INLINE_LABEL[channel])
        const costs = attempted.map((channel) => {
            const cost = unitCosts[channel]
            const name = CHANNEL_LABEL[channel]
            if (cost == null) return `${name} puede generar costo`
            if (cost === 0) return `${name} hoy no tiene costo`
            return `${name} cuesta ${formatUsdRate(cost)}`
        })
        sentences.unshift(
            `También saldrá por ${names.join(" y ")}. ${costs.join("; ")}.`,
        )
    }

    return sentences.length > 0 ? sentences.join(" ") : null
}

// ── Override por unidad ────────────────────────────────────────────────────

/**
 * Lo que decide un listing: heredar de la propiedad (no hay override), o fijar
 * su propio conjunto de canales (override ACTIVO cuyo `channels` reemplaza
 * entero el de la propiedad).
 */
export type DeliveryOverrideSelection =
    | { kind: "inherit" }
    | { kind: "custom"; channels: DeliveryChannel[] }

/**
 * Cómo se lee un override existente. Un override INACTIVO equivale a «solo
 * email» para el backend (§3.5); se presenta así y al guardar se normaliza a un
 * override activo con `channels: ["email"]`, la forma legible del doc.
 */
export function readOverrideSelection(override: ListingAutomationOverride | null | undefined): DeliveryOverrideSelection {
    if (!override) return { kind: "inherit" }
    if (!override.isActive) return { kind: "custom", channels: [...EMAIL_ONLY] }
    const channels = readDeliveryChannels(override.parameters)
    return { kind: "custom", channels: channels.length > 0 ? channels : [...EMAIL_ONLY] }
}

export function sameOverrideSelection(a: DeliveryOverrideSelection, b: DeliveryOverrideSelection): boolean {
    if (a.kind !== b.kind) return false
    if (a.kind === "inherit" || b.kind === "inherit") return true
    return sameChannelSet(optionalChannelsOf(a.channels), optionalChannelsOf(b.channels))
}

// ── Errores de validación de `channels` ────────────────────────────────────

/**
 * Mensajes del 422 de canales (§3.4 + §13.3 + §13.4), ya traducidos por el
 * backend: `parameters.channels` o `parameters.channels.N`. Se muestran tal
 * cual junto a las casillas; `[]` = el error no es de canales.
 */
export function readChannelErrors(errors: unknown): string[] {
    if (!errors || typeof errors !== "object" || Array.isArray(errors)) return []
    return Object.entries(errors as Record<string, unknown>)
        .filter(([key]) => key === "parameters.channels" || key.startsWith("parameters.channels."))
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
        .filter((message): message is string => typeof message === "string" && message.trim() !== "")
}

// ── Creación de la fila ────────────────────────────────────────────────────

/** Nombre del doc §3.3; se usa solo si el provider no declara un slot con nombre. */
const DEFAULT_AUTOMATION_NAME = "Check-in Link Delivery"

/**
 * Orden para una fila nueva cuando el provider no declara `default_setup`.
 * Regla del skill: en `POST /property-automations` se envía SIEMPRE un
 * `executionOrder >= 3` — una fila con orden nulo o <= 2 es slot de identidad
 * para el backend. Se toma el siguiente al mayor existente; el servidor
 * renumera igual, así que solo importa que no caiga en rango de identidad.
 */
export function nextExecutionOrder(existing: PropertyAutomation[]): number {
    const max = existing.reduce((acc, automation) => Math.max(acc, automation.executionOrder ?? 0), 2)
    return max + 1
}

/**
 * Paso 1 de §3.3: la fila nace INACTIVA y con `parameters: {}`, con el provider
 * de WhatsApp (el de la automatización, también para OTA). Los canales van
 * después por `configure`, que es donde el backend los valida.
 */
export function buildCheckinLinkDeliveryCreatePayload(
    propertyUuid: string,
    provider: Provider,
    existing: PropertyAutomation[],
): PropertyAutomationCreatePayload {
    if (!isCheckinLinkDeliveryProvider(provider)) {
        throw new Error(`El provider ${provider.parameters?.slug ?? provider.id} no es ${CHECKIN_LINK_DELIVERY_SLUG}.`)
    }
    const slot = provider.parameters.default_setup?.slots?.[0]
    const slotOrder = slot?.order
    return {
        propertyUuid,
        providerId: provider.id,
        name: slot?.name ?? DEFAULT_AUTOMATION_NAME,
        guestType: slot?.guest_type ?? "all",
        executionOrder: slotOrder != null && slotOrder >= 3 ? slotOrder : nextExecutionOrder(existing),
        parameters: {},
        statusProviderId: AUTOMATION_STATUS.INACTIVE,
    }
}
