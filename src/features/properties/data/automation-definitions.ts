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
} from "lucide-react"
import type { AutomationDefinition, ParameterFieldSchema } from "../types/automation"

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
        isMandatory: false,
        providerOptions: [
            {
                value: "didit",
                label: "Didit — Biométrico + ID",
                description: "Reconocimiento facial y verificación de documento en tiempo real. El huésped completa la verificación directamente en el check-in.",
                parametersSchema: [],
            },
            {
                value: "textract",
                label: "HIT AI — OCR de Documento",
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
        isMandatory: false,
        providerOptions: [
            {
                value: "didit",
                label: "Didit — Biométrico + ID",
                description: "Reconocimiento facial y verificación de documento en tiempo real.",
                parametersSchema: [],
            },
            {
                value: "textract",
                label: "HIT AI — OCR de Documento",
                description: "El huésped sube fotos de su documento. La IA extrae y valida los datos automáticamente.",
                parametersSchema: [],
            },
        ],
    },

    // ── Order 3: Digital Contract ─────────────────────────────────────
    {
        order: 3,
        id: "digital-contract",
        title: "Contrato Digital",
        description: "Firma de contrato digital con validez legal antes de completar el check-in. Obligatorio para generar el PDF del contrato.",
        icon: FileText,
        color: "text-blue-500",
        bgColor: "bg-blue-50",
        guestType: "main",
        requiresConfig: true,
        isMandatory: true,
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
                // Fallback id if the slug can't be resolved from GET /providers.
                providerId: 1005,
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
                        type: "array",
                        required: true,
                        arrayItemSchema: [
                            { key: "email", label: "Correo electrónico", type: "email", required: true, placeholder: "destino@email.com" },
                        ],
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
                        placeholder: "Token provisto por la Policía Nacional",
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
                        key: "company_code",
                        label: "NIT / Código Empresa",
                        type: "text",
                        required: true,
                        placeholder: "NIT del establecimiento",
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
                        key: "company_code",
                        label: "NIT / Código Empresa",
                        type: "text",
                        required: true,
                        placeholder: "NIT del establecimiento",
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

/**
 * Provider-specific override parameter fields, keyed by provider slug.
 *
 * Overrides are a *delta*: only the keys configured here are sent for a listing;
 * the rest inherit from the property automation. The backend exposes the slug at
 * `propertyAutomation.provider.parameters.slug` (which may use `-` or `_`), so
 * lookups go through `getOverrideFieldSchema()` which normalizes the slug.
 *
 * Providers with no PM-configurable params (didit, textract, tufirma) are absent
 * here — the modal renders only the generic key-value editor + status toggle.
 */
const OVERRIDE_FIELD_SCHEMAS: Record<string, ParameterFieldSchema[]> = {
    // TTLock — each listing has its own physical locks.
    ttlock: [
        {
            key: "locks",
            label: "Cerraduras de esta unidad",
            type: "array",
            required: false,
            arrayItemSchema: [
                { key: "lock_id", label: "ID Cerradura", type: "number", required: true, placeholder: "998877" },
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

    // PDF Report — per-listing recipient list for the guest report.
    "pdf-report": [
        {
            key: "recipients",
            label: "Destinatarios del reporte",
            type: "array",
            required: false,
            arrayItemSchema: [
                { key: "email", label: "Correo electrónico", type: "email", required: true, placeholder: "encargado@finca.co" },
            ],
        },
    ],

    // TRA Colombia — each listing may have its own RNT (token rarely overridden).
    "tra-colombia": [
        { key: "rnt", label: "RNT (Registro Nacional de Turismo)", type: "text", required: false, placeholder: "987654321" },
        { key: "token", label: "Token API TRA (avanzado)", type: "password", required: false, placeholder: "Dejar vacío para heredar de la propiedad" },
    ],

    // SIRE Colombia — company_code is the common override; the rest rarely change.
    "sire-colombia": [
        {
            key: "document_type",
            label: "Tipo de Documento",
            type: "select",
            required: false,
            options: [
                { value: "CC", label: "Cédula de Ciudadanía" },
                { value: "CE", label: "Cédula de Extranjería" },
                { value: "PEP", label: "Permiso Especial de Permanencia" },
                { value: "PA", label: "Pasaporte" },
                { value: "NIT", label: "NIT" },
            ],
        },
        { key: "document_number", label: "Número de Documento", type: "text", required: false, placeholder: "Heredar de la propiedad" },
        { key: "password", label: "Contraseña SIRE", type: "password", required: false, placeholder: "Heredar de la propiedad" },
        { key: "company_code", label: "NIT / Código Empresa", type: "text", required: false, placeholder: "901987654" },
    ],
}

/** Normalizes a provider slug/path so `sire_colombia` and `sire-colombia` both match. */
function normalizeSlug(slug: string | null | undefined): string {
    return (slug ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

const NORMALIZED_OVERRIDE_SCHEMAS: Record<string, ParameterFieldSchema[]> = Object.fromEntries(
    Object.entries(OVERRIDE_FIELD_SCHEMAS).map(([slug, schema]) => [normalizeSlug(slug), schema]),
)

/**
 * Returns the provider-specific override fields for a given provider slug, or an
 * empty array if the provider has no PM-configurable parameters.
 */
export function getOverrideFieldSchema(slug: string | null | undefined): ParameterFieldSchema[] {
    return NORMALIZED_OVERRIDE_SCHEMAS[normalizeSlug(slug)] ?? []
}
