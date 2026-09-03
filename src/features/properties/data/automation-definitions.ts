/**
 * Automation Definitions — Static UI metadata for the 8 automation orders.
 *
 * Each definition describes how to render the automation card, which providers
 * are available, and what parameters are needed for configuration.
 */

import {
    Shield,
    FileText,
    Key,
    Send,
    Globe,
    ClipboardList,
    Sparkles,
} from "lucide-react"
import { isSignatureProvider, type AutomationDefinition, type ParameterFieldSchema, type PropertyAutomation } from "../types/automation"

export const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
    // ── Order 1: Identity Verification (Main Guest) ──────────────────
    {
        order: 1,
        id: "identity-verification-main",
        title: "Verificación de Identidad (Principal)",
        description: "Verificar la identidad del huésped principal mediante reconocimiento facial o análisis de documento con IA.",
        icon: Shield,
        color: "text-violet-500",
        bgColor: "bg-violet-50",
        guestType: "main",
        requiresConfig: false,
        // Structural slot: the backend creates it for every property and rejects
        // deactivation once active. The PM still chooses the provider and can
        // activate an initially inactive slot.
        isMandatory: true,
        providerOptions: [
            {
                value: "didit",
                label: "Verificación avanzada",
                shortLabel: "avanzada",
                description: "Reconocimiento facial y verificación de documento en tiempo real. El huésped completa la verificación directamente en el check-in.",
                parametersSchema: [],
            },
            {
                value: "textract",
                label: "Verificación esencial",
                shortLabel: "esencial",
                description: "El huésped sube fotos de su documento. La IA extrae y valida los datos automáticamente.",
                parametersSchema: [],
            },
        ],
    },

    // ── Order 2: Identity Verification (Secondary Guests) ────────────
    {
        order: 2,
        id: "identity-verification-secondary",
        title: "Verificación de Identidad (Secundarios)",
        description: "Verificar la identidad de los huéspedes acompañantes. Puede usar un proveedor distinto al del huésped principal.",
        icon: Shield,
        color: "text-violet-500",
        bgColor: "bg-violet-50",
        guestType: "secondary",
        requiresConfig: false,
        isMandatory: true,
        providerOptions: [
            {
                value: "didit",
                label: "Verificación avanzada",
                shortLabel: "avanzada",
                description: "Reconocimiento facial y verificación de documento en tiempo real.",
                parametersSchema: [],
            },
            {
                value: "textract",
                label: "Verificación esencial",
                shortLabel: "esencial",
                description: "El huésped sube fotos de su documento. La IA extrae y valida los datos automáticamente.",
                parametersSchema: [],
            },
        ],
    },

    // ── Order 3: Digital Contract ─────────────────────────────────────
    {
        order: 3,
        id: "digital-contract",
        // "Contrato", no "Firma Digital": la firma dejó de ser un nodo suelto y
        // es un atributo del contrato de cada canal (spec de Ricardo,
        // `docs/RICARDO_API_CONTRACTS.md` §8.1.5). El nombre viejo hacía leer la
        // tarjeta como si configurara quién firma, cuando eso se decide en la
        // pestaña Documentos.
        //
        // Este título es la ÚNICA fuente: la tarjeta de Propiedades y el panel de
        // automatizaciones de una reserva lo leen de acá vía
        // `TITLE_BY_DEFINITION_ID` / `AUTOMATION_TITLE_OVERRIDES`
        // (`reservations/components/automations/automation-status-meta.ts`).
        title: "Contrato",
        description: "Firma opcional de un contrato digital antes de completar el check-in. Solo aplica cuando el administrador la activa y configura.",
        icon: FileText,
        color: "text-blue-500",
        bgColor: "bg-blue-50",
        guestType: "main",
        requiresConfig: true,
        isMandatory: false,
        providerOptions: [
            {
                value: "tufirma",
                label: "TuFirma",
                description: "Firma electrónica con validez legal en Colombia.",
                // Per the providers spec, Digital Contract (order 3) takes NO parameters —
                // TuFirma uses HIT's internal config. The previous welcome-content fields
                // (arrival instructions, access codes, wifi, house rules) were orphaned
                // (never read anywhere) and belong at the property/listing level, not here.
                parametersSchema: [],
            },
            {
                value: "hitguest_signature",
                label: "HIT Guest — Firma Nativa",
                description: "Firma dibujada directamente en el portal del huésped, sin dependencia externa ni email.",
                parametersSchema: [],
            },
        ],
    },

    // ── Order 4: Smart Lock Codes ─────────────────────────────────────
    {
        order: 4,
        id: "smart-lock-codes",
        title: "Códigos de Cerradura Inteligente",
        description: "Genera automáticamente un código de acceso único en las cerraduras inteligentes al completar el check-in.",
        icon: Key,
        color: "text-amber-500",
        bgColor: "bg-amber-50",
        guestType: "all",
        requiresConfig: true,
        isMandatory: false,
        providerOptions: [
            {
                value: "ttlock",
                label: "TTLock",
                description: "Integración con cerraduras inteligentes TTLock.",
                parametersSchema: [
                    {
                        key: "username",
                        label: "Usuario TTLock",
                        type: "email",
                        required: true,
                        placeholder: "cuenta@email.com",
                    },
                    {
                        key: "password",
                        label: "Contraseña TTLock",
                        type: "password",
                        required: true,
                        placeholder: "••••••••",
                    },
                    // El slot real de `default_setup` pide también estas dos
                    // (verificado en `GET /providers?country=CO` el 2026-08-13:
                    // params = client_id, client_secret, locks, password,
                    // username). La referencia vieja de proveedores decía que HIT
                    // las gestionaba internamente y por eso faltaban acá: el PM
                    // guardaba una configuración incompleta.
                    {
                        key: "client_id",
                        label: "Client ID",
                        type: "text",
                        required: true,
                        placeholder: "Client ID de la app TTLock",
                    },
                    {
                        key: "client_secret",
                        label: "Client Secret",
                        type: "password",
                        required: true,
                        placeholder: "••••••••",
                    },
                    {
                        key: "locks",
                        label: "Cerraduras",
                        type: "array",
                        required: true,
                        arrayItemSchema: [
                            { key: "lock_id", label: "ID Cerradura", type: "number", required: true, placeholder: "123456" },
                            { key: "name", label: "Nombre", type: "text", required: true, placeholder: "Puerta principal" },
                            {
                                key: "type",
                                label: "Tipo",
                                type: "select",
                                required: true,
                                options: [
                                    { value: "building_entrance", label: "Entrada edificio" },
                                    { value: "unit_entrance", label: "Entrada unidad" },
                                    { value: "amenity", label: "Amenidad" },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
        // NOTE: Only lock_id can be overridden per-listing (credentials shared at property level)
        listingOverrideSchema: [
            {
                key: "lock_id",
                label: "ID de Cerradura de esta Unidad",
                type: "text" as const,
                required: false,
                placeholder: "345678",
            },
        ],
    },

    // ── Order 5: Guest Report PDF ─────────────────────────────────────
    {
        order: 5,
        id: "guest-report-pdf",
        title: "Reporte PDF de Huéspedes",
        description: "Envía automáticamente un reporte PDF con los datos de todos los huéspedes al completar el check-in.",
        icon: Send,
        color: "text-teal-500",
        bgColor: "bg-teal-50",
        guestType: "all",
        requiresConfig: true,
        isMandatory: false,
        providerOptions: [
            {
                value: "pdf-report",
                label: "Reporte PDF",
                description: "Genera y envía el reporte por correo electrónico a los destinatarios configurados.",
                parametersSchema: [
                    {
                        key: "recipients",
                        label: "Destinatarios",
                        type: "string_array",
                        itemType: "email",
                        required: true,
                        placeholder: "destino@email.com",
                    },
                ],
            },
        ],
    },

    // ── Order 6: TRA Colombia ─────────────────────────────────────────
    {
        order: 6,
        id: "tra-colombia",
        title: "TRA Colombia",
        description: "Registro automático de huéspedes ante la Policía Nacional de Turismo (TRA). Obligatorio para establecimientos de alojamiento.",
        icon: Globe,
        color: "text-green-500",
        bgColor: "bg-green-50",
        guestType: "all",
        requiresConfig: true,
        isMandatory: false,
        providerOptions: [
            {
                value: "tra-colombia",
                label: "TRA Colombia",
                description: "Reporte automático a la Policía Nacional de Turismo de Colombia.",
                parametersSchema: [
                    {
                        key: "token",
                        label: "Token API TRA",
                        type: "password",
                        required: true,
                        placeholder: "Token provisto por el Ministerio de Comercio, Industria y Turismo (MINCIT)",
                    },
                    {
                        key: "rnt",
                        label: "RNT (Registro Nacional de Turismo)",
                        type: "text",
                        required: true,
                        placeholder: "Número RNT del establecimiento",
                    },
                ],
            },
        ],
        // NOTE: rnt and token can differ per-listing (e.g. apart-hotel with different RNT per unit)
        listingOverrideSchema: [
            {
                key: "rnt",
                label: "RNT de esta Unidad",
                type: "text" as const,
                required: false,
                placeholder: "Número RNT específico de esta unidad",
            },
            {
                key: "token",
                label: "Token API TRA (si es diferente al de la propiedad)",
                type: "password" as const,
                required: false,
                placeholder: "••••••••",
            },
        ],
    },

    // ── Order 7: SIRE Colombia (Check-in) ────────────────────────────
    {
        order: 7,
        id: "sire-colombia-checkin",
        title: "SIRE Colombia — Check-in",
        description: "Registro automático de huéspedes extranjeros ante Migración Colombia (SIRE) al hacer check-in.",
        icon: ClipboardList,
        color: "text-indigo-500",
        bgColor: "bg-indigo-50",
        guestType: "all",
        requiresConfig: true,
        isMandatory: false,
        providerOptions: [
            {
                value: "sire-colombia",
                label: "SIRE Colombia",
                description: "Sistema de Información para el Registro de Extranjeros — Migración Colombia.",
                parametersSchema: [
                    {
                        key: "document_type",
                        label: "Tipo de Documento",
                        type: "select",
                        required: true,
                        options: [
                            { value: "CC", label: "Cédula de Ciudadanía" },
                            { value: "CE", label: "Cédula de Extranjería" },
                            { value: "PEP", label: "Permiso Especial de Permanencia" },
                            { value: "PA", label: "Pasaporte" },
                            { value: "NIT", label: "NIT" },
                        ],
                    },
                    {
                        key: "document_number",
                        label: "Número de Documento",
                        type: "text",
                        required: true,
                        placeholder: "Número del documento del representante",
                    },
                    {
                        key: "password",
                        label: "Contraseña SIRE",
                        type: "password",
                        required: true,
                        placeholder: "••••••••",
                    },
                    {
                        // OPCIONAL a propósito, no un olvido: el job lee la empresa
                        // reportante de la propia página de login de SIRE y solo usa
                        // este parámetro cuando viene con valor. Solo hace falta para
                        // PMs que reportan por más de una empresa.
                        key: "company_code",
                        label: "NIT / Código Empresa (opcional)",
                        type: "text",
                        required: false,
                        placeholder: "Solo si reportas por más de una empresa",
                    },
                ],
            },
        ],
        // NOTE: company_code can differ per-listing in apart-hotels with separate NITs
        listingOverrideSchema: [
            {
                key: "company_code",
                label: "NIT / Código Empresa de esta Unidad",
                type: "text" as const,
                required: false,
                placeholder: "NIT específico (dejar vacío para heredar de la propiedad)",
            },
        ],
    },

    // ── Order 8: SIRE Colombia (Check-out) ───────────────────────────
    {
        order: 8,
        id: "sire-colombia-checkout",
        title: "SIRE Colombia — Check-out",
        description: "Notificación automática de salida de huéspedes extranjeros ante Migración Colombia (SIRE) al hacer check-out.",
        icon: ClipboardList,
        color: "text-indigo-500",
        bgColor: "bg-indigo-50",
        guestType: "all",
        requiresConfig: true,
        isMandatory: false,
        providerOptions: [
            {
                value: "sire-colombia",
                label: "SIRE Colombia",
                description: "Comparte credenciales con el check-in SIRE. Si ya configuraste el check-in, estas credenciales son las mismas.",
                parametersSchema: [
                    {
                        key: "document_type",
                        label: "Tipo de Documento",
                        type: "select",
                        required: true,
                        options: [
                            { value: "CC", label: "Cédula de Ciudadanía" },
                            { value: "CE", label: "Cédula de Extranjería" },
                            { value: "PEP", label: "Permiso Especial de Permanencia" },
                            { value: "PA", label: "Pasaporte" },
                            { value: "NIT", label: "NIT" },
                        ],
                    },
                    {
                        key: "document_number",
                        label: "Número de Documento",
                        type: "text",
                        required: true,
                        placeholder: "Número del documento del representante",
                    },
                    {
                        key: "password",
                        label: "Contraseña SIRE",
                        type: "password",
                        required: true,
                        placeholder: "••••••••",
                    },
                    {
                        // OPCIONAL a propósito, no un olvido: el job lee la empresa
                        // reportante de la propia página de login de SIRE y solo usa
                        // este parámetro cuando viene con valor. Solo hace falta para
                        // PMs que reportan por más de una empresa.
                        key: "company_code",
                        label: "NIT / Código Empresa (opcional)",
                        type: "text",
                        required: false,
                        placeholder: "Solo si reportas por más de una empresa",
                    },
                ],
            },
        ],
        listingOverrideSchema: [
            {
                key: "company_code",
                label: "NIT / Código Empresa de esta Unidad",
                type: "text" as const,
                required: false,
                placeholder: "NIT específico (dejar vacío para heredar de la propiedad)",
            },
        ],
    },
]

const DEFINITION_BY_ID = new Map(AUTOMATION_DEFINITIONS.map((definition) => [definition.id, definition]))

function normalizedSlug(value: string | null | undefined): string {
    return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Maps an API automation to UI metadata without using executionOrder for any
 * non-identity automation. Unknown future providers still render as a generic
 * card, so adding a backend provider never makes the row disappear.
 */
export function definitionForAutomation(automation: PropertyAutomation): AutomationDefinition {
    const providerSlug = automation.provider?.parameters?.slug ?? automation.providerName
    const slug = normalizedSlug(providerSlug ?? automation.name)

    // La capacidad del provider gana sobre cualquier orden. El backend puede
    // renumerar las filas y la firma estructural también usa main_guest; si se
    // mira primero `order <= 2`, hitguest_signature se pinta como una segunda
    // verificación principal (aunque el resto de la tarjeta detecte que es firma).
    const isSignature =
        (!!automation.provider && isSignatureProvider(automation.provider))
        || slug === "hitguestsignature"
        || slug === "tufirma"
    if (isSignature) {
        return { ...DEFINITION_BY_ID.get("digital-contract")!, order: automation.executionOrder }
    }

    // La señal semántica de identidad es `verification_type`. Los slugs conocidos
    // mantienen la clasificación cuando la relación provider no viene sideloaded.
    // El criterio histórico guestType+order queda solo como fallback para filas
    // legacy que todavía no exponen providerSlug.
    const isIdentityProvider =
        !!automation.provider?.parameters?.verification_type
        || slug === "didit"
        || slug === "textract"
    const isLegacyIdentity = !providerSlug
        && automation.executionOrder <= 2
        && automation.guestType !== "all"
    if ((isIdentityProvider || isLegacyIdentity) && automation.guestType !== "all") {
        const identityId = automation.guestType === "secondary_guest"
            ? "identity-verification-secondary"
            : "identity-verification-main"
        return { ...DEFINITION_BY_ID.get(identityId)!, order: automation.executionOrder }
    }

    let id: string | null = null
    if (slug.includes("ttlock")) id = "smart-lock-codes"
    else if (slug.includes("pdfreport")) id = "guest-report-pdf"
    else if (slug.includes("tracolombia")) id = "tra-colombia"
    else if (slug.includes("sirecolombia")) {
        id = /out|salida/i.test(automation.name) ? "sire-colombia-checkout" : "sire-colombia-checkin"
    }

    if (id) return { ...DEFINITION_BY_ID.get(id)!, order: automation.executionOrder }

    return {
        order: automation.executionOrder,
        id: `automation-${automation.uuid}`,
        title: automation.name || automation.provider?.name || "Automatización",
        description: automation.provider?.description || "Automatización configurada para esta propiedad.",
        icon: Sparkles,
        color: "text-slate-500",
        bgColor: "bg-slate-50",
        providerOptions: providerSlug ? [{
            value: providerSlug,
            label: automation.provider?.name || providerSlug,
            description: automation.provider?.description || "Proveedor configurado por el backend.",
            parametersSchema: [],
            providerId: automation.providerId ?? undefined,
        }] : [],
        guestType: automation.guestType === "main_guest"
            ? "main"
            : automation.guestType === "secondary_guest" ? "secondary" : "all",
        requiresConfig: false,
        isMandatory: false,
    }
}

/** Normalizes a provider slug/path so `sire_colombia` and `sire-colombia` both match. */
function normalizeSlug(slug: string | null | undefined): string {
    return (slug ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Map of normalized provider slug → the property-level config parameter schema.
 *
 * A listing override reuses the SAME fields the PM configures at the property
 * level (TRA → token+rnt, SIRE → document/password/company_code, TTLock → locks,
 * PDF → recipients). This is the single source of truth, so the PM never types
 * raw variable names and the override can never drift from the property config.
 *
 * Providers with no configurable params (didit, textract, tufirma) are absent →
 * they cannot be overridden.
 */
const PROVIDER_PARAM_SCHEMAS: Record<string, ParameterFieldSchema[]> = (() => {
    const map: Record<string, ParameterFieldSchema[]> = {}
    for (const def of AUTOMATION_DEFINITIONS) {
        for (const opt of def.providerOptions ?? []) {
            if (opt.parametersSchema && opt.parametersSchema.length > 0) {
                map[normalizeSlug(opt.value)] = opt.parametersSchema
            }
        }
    }
    return map
})()

/**
 * Returns the override fields for a provider — identical to its property-level
 * config schema, but with every field made optional (leaving one empty inherits
 * that value from the property automation). Empty array = not overridable.
 */
export function getOverrideFieldSchema(slug: string | null | undefined): ParameterFieldSchema[] {
    const base = PROVIDER_PARAM_SCHEMAS[normalizeSlug(slug)] ?? []
    return base.map((f) => ({ ...f, required: false }))
}

/** Whether a provider supports listing-level overrides (i.e. has configurable params). */
export function isOverridableSlug(slug: string | null | undefined): boolean {
    return (PROVIDER_PARAM_SCHEMAS[normalizeSlug(slug)] ?? []).length > 0
}
