/**
 * TRA y SIRE con credenciales por alojamiento (contrato 2026-11-10; plan
 * `.claude/plans/20261112_tra-sire-credenciales-por-alojamiento.md`).
 *
 * Única fuente de dos preguntas:
 *   - ¿esta automatización trabaja con las credenciales de la propiedad o con
 *     las de cada alojamiento?
 *   - en el modo por alojamiento, ¿en qué estado está UN alojamiento?
 *
 * En modo por alojamiento no existe «heredar»: un alojamiento sin credenciales
 * no se reporta (el backend registra `credentials_missing`).
 */
import { canonicalSlug } from "../services/automation-service"
import { getProviderParamSchema } from "../data/automation-definitions"
import { LISTING_OVERRIDE_STATUS, type ListingAutomationOverride } from "../types/automation"

export type CredentialsScope = "property" | "listing"

/** Solo TRA y SIRE admiten el modo (contrato §2: en otra automatización, 422). */
const LISTING_CREDENTIAL_SLUGS: ReadonlySet<string> = new Set(["tra_colombia", "sire_colombia"])

/** Lo mínimo de una automatización para decidir su modo: su slug y sus parámetros. */
export interface ScopedAutomation {
    parameters?: Record<string, unknown> | null
    provider?: { parameters?: { slug?: string | null } | null } | null
    providerName?: string | null
}

function slugOf(automation: ScopedAutomation | null | undefined): string {
    return automation?.provider?.parameters?.slug ?? automation?.providerName ?? ""
}

export function supportsListingCredentials(automationOrSlug: ScopedAutomation | string | null | undefined): boolean {
    const slug = typeof automationOrSlug === "string" ? automationOrSlug : slugOf(automationOrSlug)
    return LISTING_CREDENTIAL_SLUGS.has(canonicalSlug(slug))
}

/**
 * `parameters.credentials_scope`. Solo `"listing"`, en TRA o SIRE, es el modo
 * por alojamiento. Ausente, `null`, `"property"` o un valor desconocido es
 * `"property"`, el modo que exige credenciales: un dato que no entendemos nunca
 * permite activar sin ellas.
 */
export function readCredentialsScope(automation: ScopedAutomation | null | undefined): CredentialsScope {
    if (!supportsListingCredentials(automation)) return "property"
    return automation?.parameters?.credentials_scope === "listing" ? "listing" : "property"
}

/**
 * Claves que el override de un alojamiento debe traer en modo por alojamiento:
 * los `required` del esquema del proveedor, el mismo que se configura en la
 * propiedad. Una sola fuente; coincide con la validación del contrato §3
 * (TRA: token y rnt · SIRE: document_type, document_number y password).
 */
export function requiredListingCredentialKeys(slug: string | null | undefined): string[] {
    if (!supportsListingCredentials(slug ?? "")) return []
    return getProviderParamSchema(slug).filter((f) => f.required).map((f) => f.key)
}

/** Nombre visible de una clave de credencial: la etiqueta del esquema; la clave cruda solo si no la conocemos. */
export function credentialLabel(slug: string | null | undefined, key: string): string {
    return getProviderParamSchema(slug).find((f) => f.key === key)?.label ?? key
}

export type ListingCredentialState =
    /** Sin override: el alojamiento no se reporta. */
    | { kind: "missing" }
    /** Override apagado (7): excluido a propósito. No pide credenciales. */
    | { kind: "excluded" }
    /** El backend confirma que las credenciales están completas. */
    | { kind: "ready" }
    /** El backend dice que faltan; `missing` son las claves que informó (puede venir vacío). */
    | { kind: "incomplete"; missing: string[] }
    /** Override activo sin metadatos del backend (o contradictorios): no se puede afirmar nada. */
    | { kind: "unknown" }

/**
 * Estado de UN alojamiento en modo por alojamiento. `ready` e `incomplete`
 * salen SOLO de los metadatos del backend (`credentialsComplete`,
 * `missingCredentialKeys`): nunca de los valores, porque un secreto guardado
 * puede llegar omitido y eso no significa que falte.
 */
export function listingCredentialState(override: ListingAutomationOverride | null | undefined): ListingCredentialState {
    if (!override) return { kind: "missing" }
    if (override.statusRecordId === LISTING_OVERRIDE_STATUS.INACTIVE) return { kind: "excluded" }
    const { credentialsComplete, missingCredentialKeys } = override
    if (credentialsComplete === true) {
        // «Completo» con claves faltantes se contradice: no se elige una de las dos.
        return missingCredentialKeys && missingCredentialKeys.length > 0 ? { kind: "unknown" } : { kind: "ready" }
    }
    if (credentialsComplete === false) return { kind: "incomplete", missing: missingCredentialKeys ?? [] }
    return { kind: "unknown" }
}

export type ListingCredentialSummary = {
    tone: "success" | "warning" | "idle"
    label: string
}

/**
 * Texto visible del estado, derivado exclusivamente de
 * `listingCredentialState`. Centralizarlo evita que una pantalla vuelva a
 * interpretar la presencia de `parameters` como credenciales completas.
 */
export function listingCredentialSummary(
    slug: string | null | undefined,
    override: ListingAutomationOverride | null | undefined,
): ListingCredentialSummary {
    // Un borrador (unidad nueva, `uuid` vacío) es estado local: lo que trae es
    // exactamente lo que el PM escribió, así que acá SÍ se puede mirar el valor.
    // Sin esto todo borrador decía «No pudimos confirmar…», que habla de un
    // backend que todavía no lo vio.
    if (override && !override.uuid && override.statusRecordId !== LISTING_OVERRIDE_STATUS.INACTIVE) {
        const params = (override.parameters ?? {}) as Record<string, unknown>
        const missing = requiredListingCredentialKeys(slug).filter((key) => params[key] == null || params[key] === "")
        return missing.length > 0
            ? { tone: "warning", label: `Faltan: ${missing.map((key) => credentialLabel(slug, key)).join(", ")}` }
            : { tone: "idle", label: "Se envían al guardar la unidad" }
    }
    const state = listingCredentialState(override)
    switch (state.kind) {
        case "missing":
            return { tone: "warning", label: LISTING_CREDENTIALS_COPY.noCredentials }
        case "excluded":
            return { tone: "idle", label: LISTING_CREDENTIALS_COPY.excluded }
        case "ready":
            return { tone: "success", label: "Credenciales configuradas" }
        case "incomplete": {
            const labels = state.missing.map((key) => credentialLabel(slug, key))
            return {
                tone: "warning",
                label: labels.length > 0 ? `Faltan: ${labels.join(", ")}` : "Credenciales incompletas",
            }
        }
        case "unknown":
            return { tone: "warning", label: "No pudimos confirmar las credenciales" }
    }
}

/**
 * Textos del modo por alojamiento. En él no existe «heredar»: sin override el
 * alojamiento no se reporta, y apagarlo es excluirlo a propósito. Una sola
 * fuente para el modal del alojamiento y los dos paneles (por automatización y
 * pestaña AUTOM. de la unidad), así no pueden divergir.
 */
export const LISTING_CREDENTIALS_COPY = {
    /** Alojamiento sin override. */
    noCredentials: "Sin credenciales · no se reporta",
    /** Override apagado (7). */
    excluded: "Excluido · no se reporta",
    /** Panel cargado y ningún alojamiento con override. */
    noneConfigured: "Ningún alojamiento tiene credenciales: no se reporta ninguno",
    /** Interruptor del modal, encendido / apagado. */
    activeLabel: "Se reporta con sus credenciales",
    excludedLabel: "Excluido: no se reporta",
    activeHelpNew: "Carga las credenciales de este alojamiento. Apágalo para excluirlo: no se reporta.",
    activeHelpEdit: "Este alojamiento se reporta con las credenciales de abajo.",
    excludedHelp: "Las reservas de este alojamiento no se reportan.",
    /** Aviso sobre los campos del modal. */
    fieldsNotice: "Estas credenciales son solo de este alojamiento. Sin ellas, sus reservas no se reportan.",
    /** Guardar un alojamiento nuevo sin credenciales ni exclusión. */
    emptyCreate: "Completa las credenciales de este alojamiento o exclúyelo.",
    /** Borrar el override. */
    remove: "Quitar credenciales",
    removed: "Credenciales quitadas. Este alojamiento ya no se reporta.",
} as const
