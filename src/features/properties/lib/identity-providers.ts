/**
 * Qué proveedor del catálogo es «Avanzada» y cuál «Esencial».
 *
 * Contrato 2026-10-14 (skill de contratos, «Proveedor de identidad POR
 * UNIDAD»): los ids cambian entre ambientes — nunca se fijan en el front — y la
 * etiqueta sale de `parameters.verification_type`: `session` = Avanzada,
 * `document_upload` = Esencial. El slug (`didit` / `textract`) queda solo como
 * respaldo para un proveedor que no declare el tipo.
 *
 * Se resuelve sobre el catálogo COMPLETO, sin el filtro de «es automatización»
 * (`isAutomationProvider`): ese filtro es para decidir qué tarjetas existen, y
 * un proveedor de identidad marcado de otra forma desaparecía del selector y
 * dejaba solo el guardado (reporte de Didier, 2026-10-12/13).
 */

import { canonicalSlug } from "../services/automation-service"
import type { Provider } from "../types/automation"

export type IdentityLevel = "advanced" | "essential"

const LEVEL_BY_VERIFICATION_TYPE: Readonly<Record<string, IdentityLevel>> = {
    session: "advanced",
    document_upload: "essential",
}

const LEVEL_BY_SLUG: Readonly<Record<string, IdentityLevel>> = {
    didit: "advanced",
    textract: "essential",
}

/** Valor de la opción en `AUTOMATION_DEFINITIONS` para cada nivel. */
export const IDENTITY_OPTION_VALUE: Readonly<Record<IdentityLevel, string>> = {
    advanced: "didit",
    essential: "textract",
}

export const IDENTITY_LEVEL_LABEL: Readonly<Record<IdentityLevel, string>> = {
    advanced: "Verificación avanzada",
    essential: "Verificación esencial",
}

export function identityLevelOfVerificationType(type: string | null | undefined): IdentityLevel | null {
    return type ? LEVEL_BY_VERIFICATION_TYPE[type] ?? null : null
}

export function identityLevelOfSlug(slug: string | null | undefined): IdentityLevel | null {
    return LEVEL_BY_SLUG[canonicalSlug(slug)] ?? null
}

/** Nivel de un proveedor: primero `verification_type`, después el slug. */
export function identityLevelOfProvider(provider: Pick<Provider, "parameters"> | null | undefined): IdentityLevel | null {
    if (!provider) return null
    return identityLevelOfVerificationType(provider.parameters?.verification_type)
        ?? identityLevelOfSlug(provider.parameters?.slug)
}

export interface IdentityProviderCatalog {
    advanced: Provider | null
    essential: Provider | null
}

export const EMPTY_IDENTITY_CATALOG: IdentityProviderCatalog = { advanced: null, essential: null }

/** El primer proveedor de cada nivel en el catálogo. Lo que no está queda en `null`: no se inventa. */
export function resolveIdentityProviders(providers: readonly Provider[]): IdentityProviderCatalog {
    const catalog: IdentityProviderCatalog = { advanced: null, essential: null }
    for (const provider of providers) {
        const level = identityLevelOfProvider(provider)
        if (level && !catalog[level]) catalog[level] = provider
    }
    return catalog
}

/** El nivel al que apunta un id del catálogo, si es de identidad. */
export function identityLevelOfProviderId(catalog: IdentityProviderCatalog, providerId: number | null | undefined): IdentityLevel | null {
    if (providerId == null) return null
    if (catalog.advanced?.id === providerId) return "advanced"
    if (catalog.essential?.id === providerId) return "essential"
    return null
}
