import { AUTOMATION_STATUS, type PropertyAutomation, type PropertyAutomationCreatePayload, type Provider } from "../types/automation"
import { isSignatureProvider } from "../types/automation"

const slug = (value: string | null | undefined) =>
    (value ?? "").trim().toLowerCase().replace(/-/g, "_")

/**
 * Encuentra la fila de firma sin depender de que el backend sideloadée el
 * provider completo. `providerSlug`/`providerName` es suficiente y es más
 * estable que la relación serializada.
 */
export function findSignatureAutomation(
    automations: PropertyAutomation[],
    signatureProviders: Provider[],
): PropertyAutomation | null {
    const allowedSlugs = new Set(signatureProviders.map((provider) => slug(provider.parameters.slug)))
    return automations.find((automation) =>
        (automation.provider != null && isSignatureProvider(automation.provider))
        || allowedSlugs.has(slug(automation.providerName)),
    ) ?? null
}

export function findSignatureProvider(providers: Provider[], providerSlug: string): Provider | null {
    return providers.find((provider) => slug(provider.parameters.slug) === slug(providerSlug)) ?? null
}

/**
 * Orden del slot de firma en el `default_setup` real de `hitguest_signature`
 * (provider 1005, verificado por curl contra `GET /providers`). Se usa solo si
 * el provider llegara sin slot o con un orden en rango de identidad.
 */
const SIGNATURE_EXECUTION_ORDER = 10

/**
 * Construye la única fila estructural de firma. El proveedor de esta fila es
 * siempre HIT Guest Signature; TuFirma vive en `by_source.provider_slug`.
 */
export function buildSignatureAutomationCreatePayload(
    propertyUuid: string,
    structuralProvider: Provider,
): PropertyAutomationCreatePayload {
    if (slug(structuralProvider.parameters.slug) !== "hitguest_signature") {
        throw new Error("La fila estructural de firma requiere hitguest_signature.")
    }
    const slot = structuralProvider.parameters.default_setup?.slots[0]
    // `executionOrder` no es cosmético: el backend clasifica como slot de
    // identidad toda fila con `guest_type` + `execution_order <= 2` (así lo usa
    // en isMandatory() y en /configure). Como esta fila nace `main_guest`,
    // crearla sin orden —el POST lo permite, es nullable— la convierte en el
    // slot de identidad del huésped principal: queda imposible de desactivar
    // (422 de verificación) y activar su provider apaga la fila Didit/Textract
    // real. Siempre se envía el orden del slot, nunca uno en rango de identidad.
    const slotOrder = slot?.order
    return {
        propertyUuid,
        providerId: structuralProvider.id,
        name: slot?.name ?? "Digital Signature for Contract",
        guestType: slot?.guest_type ?? "main_guest",
        executionOrder: slotOrder != null && slotOrder >= 3 ? slotOrder : SIGNATURE_EXECUTION_ORDER,
        // POST crea la fila; PATCH /configure es el endpoint autoritativo para
        // guardar routing y activarla después de sincronizar los documentos.
        parameters: {},
        statusProviderId: AUTOMATION_STATUS.INACTIVE,
    }
}
