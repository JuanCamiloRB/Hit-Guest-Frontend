/**
 * Verificación de identidad POR UNIDAD (contrato 2026-10-14, skill de
 * contratos «Proveedor de identidad POR UNIDAD»): Heredar · Avanzada · Esencial
 * · Desactivar, por unidad y por tipo de huésped.
 *
 * Reglas puras, compartidas por los dos lugares donde se editan overrides
 * (panel de la tarjeta y pestaña AUTOM. de la unidad), para que no vuelvan a
 * divergir como pasó con «Hereda de la propiedad».
 */

import { AUTOMATION_STATUS, LISTING_OVERRIDE_STATUS } from "../types/automation"
import type {
    ListingAutomationOverride,
    ListingAutomationOverrideCreatePayload,
    ListingAutomationOverrideUpdatePayload,
    PropertyAutomation,
    Provider,
} from "../types/automation"
import {
    IDENTITY_LEVEL_LABEL,
    identityLevelOfProvider,
    identityLevelOfProviderId,
    identityLevelOfSlug,
    identityLevelOfVerificationType,
    type IdentityLevel,
    type IdentityProviderCatalog,
} from "./identity-providers"

export type IdentityChoice = "inherit" | IdentityLevel | "disabled"

/**
 * Lo que estas reglas leen del slot de la propiedad. Lo cumplen tanto la fila
 * completa (`PropertyAutomation`) como la anidada del override.
 */
interface PropertySlot {
    isActive?: boolean
    statusProviderId?: number
    providerId?: number | null
    provider?: Provider | null
    providerName?: string | null
    automationType?: PropertyAutomation["automationType"]
}

/**
 * ¿Es un slot de identidad? `automationType: "identity_verification"` es la
 * señal del contrato; el proveedor (`verification_type` o slug) cubre filas de
 * respuestas anteriores que no la traen.
 */
export function isIdentityPropertyAutomation(pa: PropertySlot | null | undefined): boolean {
    if (!pa) return false
    if (pa.automationType === "identity_verification") return true
    return identityLevelOfProvider(pa.provider) != null || identityLevelOfSlug(pa.providerName) != null
}

/** El slot de la propiedad está activo y con proveedor: solo así la unidad puede CAMBIAR el nivel. */
export function propertySlotCanBeOverridden(pa: PropertySlot | null | undefined): boolean {
    if (!pa) return false
    const active = pa.isActive === true || pa.statusProviderId === AUTOMATION_STATUS.ACTIVE
    return active && pa.providerId != null
}

/** Nivel que usa la PROPIEDAD en ese slot; `null` si está apagada o sin proveedor. */
export function propertyIdentityLevel(pa: PropertySlot | null | undefined): IdentityLevel | null {
    if (!propertySlotCanBeOverridden(pa)) return null
    return identityLevelOfProvider(pa?.provider) ?? identityLevelOfSlug(pa?.providerName)
}

export interface IdentityOverrideState {
    choice: IdentityChoice
    /** Hereda, pero la propiedad no verifica: los huéspedes solo suben fotos. */
    inheritsWithoutVerification: boolean
}

/**
 * Del override del backend a la opción del selector (tabla de la sección 3
 * del contrato). Sin `providerSource` (backend anterior), un override activo
 * se lee como herencia: es lo único que ese backend sabía hacer en identidad.
 */
export function readIdentityOverrideState(
    override: ListingAutomationOverride | null | undefined,
    catalog: IdentityProviderCatalog,
): IdentityOverrideState {
    if (!override) return { choice: "inherit", inheritsWithoutVerification: false }
    if (override.statusRecordId === LISTING_OVERRIDE_STATUS.INACTIVE) {
        return { choice: "disabled", inheritsWithoutVerification: false }
    }
    if (override.providerSource === "listing") {
        const level = identityLevelOfVerificationType(override.effectiveProvider?.verificationType)
            ?? identityLevelOfProviderId(catalog, override.providerId ?? override.effectiveProvider?.id)
        if (level) return { choice: level, inheritsWithoutVerification: false }
    }
    return { choice: "inherit", inheritsWithoutVerification: override.providerSource === null }
}

export type OverrideOperation =
    | { kind: "delete"; uuid: string }
    | { kind: "create"; payload: ListingAutomationOverrideCreatePayload }
    | { kind: "update"; uuid: string; payload: ListingAutomationOverrideUpdatePayload }

export class IdentityProviderUnavailableError extends Error {
    constructor(readonly level: IdentityLevel) {
        super(`${IDENTITY_LEVEL_LABEL[level]} no está disponible en el catálogo de proveedores.`)
    }
}

/**
 * Las llamadas que lleva cada cambio (matriz de escritura de la auditoría):
 *
 * | Elegido      | Sin override             | Activo (6)           | Desactivado (7)        |
 * |--------------|--------------------------|----------------------|------------------------|
 * | Heredar      | —                        | DELETE               | DELETE                 |
 * | Avanzada/Es. | POST 6 + providerId      | PATCH {providerId}   | DELETE + POST          |
 * | Desactivar   | POST 7 (sin proveedor)   | PATCH {7}            | —                      |
 *
 * Desactivado → proveedor va como DELETE + POST: el contrato garantiza que el
 * POST revive la fila, y evita el 422 ambiguo de mandar 6 + `providerId` sobre
 * un override desactivado. Nunca se manda `providerId` con 7 (422).
 */
export function planIdentityOverrideWrite(input: {
    current: ListingAutomationOverride | null
    choice: IdentityChoice
    catalog: IdentityProviderCatalog
    listingUuid: string
    propertyAutomationUuid: string
}): OverrideOperation[] {
    const { current, choice, catalog, listingUuid, propertyAutomationUuid } = input
    const base = { listingUuid, propertyAutomationUuid }

    if (choice === "inherit") return current ? [{ kind: "delete", uuid: current.uuid }] : []

    if (choice === "disabled") {
        if (!current) return [{ kind: "create", payload: { ...base, statusRecordId: LISTING_OVERRIDE_STATUS.INACTIVE } }]
        if (current.statusRecordId === LISTING_OVERRIDE_STATUS.INACTIVE) return []
        return [{ kind: "update", uuid: current.uuid, payload: { statusRecordId: LISTING_OVERRIDE_STATUS.INACTIVE } }]
    }

    const providerId = catalog[choice]?.id
    if (providerId == null) throw new IdentityProviderUnavailableError(choice)
    const create: OverrideOperation = {
        kind: "create",
        payload: { ...base, statusRecordId: LISTING_OVERRIDE_STATUS.ACTIVE, providerId },
    }
    if (!current) return [create]
    if (current.statusRecordId === LISTING_OVERRIDE_STATUS.INACTIVE) return [{ kind: "delete", uuid: current.uuid }, create]
    if (current.providerSource === "listing" && current.providerId === providerId) return []
    return [{ kind: "update", uuid: current.uuid, payload: { providerId } }]
}

/** «Heredar (Verificación avanzada de la propiedad)» o la explicación de por qué no verifica. */
export function inheritDescription(pa: PropertySlot | null | undefined): string {
    const level = propertyIdentityLevel(pa)
    return level
        ? `Usa lo de la propiedad: ${IDENTITY_LEVEL_LABEL[level].toLowerCase()}.`
        : "La propiedad no tiene esta verificación activa: los huéspedes solo suben fotos del documento."
}

/** Resumen de una fila en las listas de overrides. */
export function identityOverrideSummary(
    override: ListingAutomationOverride | null | undefined,
    pa: PropertySlot | null | undefined,
    catalog: IdentityProviderCatalog,
): { label: string; tone: "inherit" | "custom" | "disabled" } {
    const state = readIdentityOverrideState(override, catalog)
    if (state.choice === "disabled") return { label: "Desactivada en esta unidad", tone: "disabled" }
    if (state.choice === "advanced" || state.choice === "essential") {
        return { label: `${IDENTITY_LEVEL_LABEL[state.choice]} en esta unidad`, tone: "custom" }
    }
    const level = state.inheritsWithoutVerification ? null : propertyIdentityLevel(pa)
    return {
        label: level ? `Hereda de la propiedad (${IDENTITY_LEVEL_LABEL[level].toLowerCase()})` : "Hereda de la propiedad (sin verificación)",
        tone: "inherit",
    }
}

/**
 * Override sintetizado para una unidad que todavía no existe (borrador). Se
 * persiste con un POST después de crear la unidad; `null` = heredar (no hay
 * nada que guardar).
 */
export function draftIdentityOverride(input: {
    choice: IdentityChoice
    catalog: IdentityProviderCatalog
    listingUuid: string
    propertyAutomationUuid: string
}): Omit<ListingAutomationOverride, "propertyAutomation"> | null {
    const { choice, catalog, listingUuid, propertyAutomationUuid } = input
    const base = {
        uuid: "",
        listingUuid,
        propertyAutomationUuid,
        parameters: null,
        token: null,
        deletedAt: null,
    }
    if (choice === "inherit") return null
    if (choice === "disabled") {
        return {
            ...base,
            statusRecordId: LISTING_OVERRIDE_STATUS.INACTIVE,
            isActive: false,
            providerId: null,
            effectiveProvider: null,
            providerSource: null,
        }
    }
    const provider = catalog[choice]
    if (!provider) throw new IdentityProviderUnavailableError(choice)
    return {
        ...base,
        statusRecordId: LISTING_OVERRIDE_STATUS.ACTIVE,
        isActive: true,
        providerId: provider.id,
        effectiveProvider: {
            id: provider.id,
            name: provider.name,
            slug: provider.parameters.slug || null,
            verificationType: provider.parameters.verification_type ?? null,
        },
        providerSource: "listing",
    }
}
