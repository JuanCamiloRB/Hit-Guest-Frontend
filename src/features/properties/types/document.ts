/**
 * Property Document types — text documents (contracts, rules, instructions,
 * privacy policies) configured per property. Content uses {{shortcode}} tokens
 * replaced on-the-fly with reservation data when rendered for a guest.
 */

export type ShortcodeKey =
    | "reservation_code"
    | "guest_first_name"
    | "guest_last_name"
    | "guest_identification_type"
    | "guest_identification_number"
    | "checkin_date"
    | "checkout_date"
    | "checkin_time"
    | "checkout_time"
    | "total_nights"
    | "total_guests"
    | "total_price"
    | "listing_name"
    | "property_name"
    | "property_address"

/** Human-friendly Spanish labels for each shortcode (UI only). */
export const SHORTCODE_LABELS: Record<string, string> = {
    reservation_code: "Código de reserva",
    guest_first_name: "Nombre del huésped",
    guest_last_name: "Apellido del huésped",
    guest_identification_type: "Tipo de documento",
    guest_identification_number: "Número de documento",
    checkin_date: "Fecha de entrada",
    checkout_date: "Fecha de salida",
    checkin_time: "Hora de entrada",
    checkout_time: "Hora de salida",
    total_nights: "Total de noches",
    total_guests: "Total de huéspedes",
    total_price: "Precio total",
    listing_name: "Nombre de la unidad",
    property_name: "Nombre de la propiedad",
    property_address: "Dirección de la propiedad",
}

/** Reverse lookup: Spanish label (lowercased) → shortcode key. */
const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
    Object.entries(SHORTCODE_LABELS).map(([key, label]) => [label.toLowerCase(), key]),
)

/**
 * Normalizes placeholders so the backend render can substitute them.
 *
 * Documents are sometimes authored with the human label inside the braces
 * (e.g. `{{ Nombre de la propiedad }}`) instead of the real shortcode key
 * (`{{property_name}}`). The render endpoint only replaces the keys, so the
 * labels would survive verbatim in the guest-facing document. This converts any
 * recognized label back to its key. Tokens already using a key — or unknown
 * tokens — are left untouched. Tolerant of surrounding whitespace.
 */
export function normalizeShortcodes(html: string): string {
    if (!html) return html
    return html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, inner: string) => {
        const trimmed = inner.trim()
        // Already a valid shortcode key → keep, but drop any stray inner spaces.
        if (SHORTCODE_LABELS[trimmed]) return `{{${trimmed}}}`
        const key = LABEL_TO_KEY[trimmed.toLowerCase()]
        return key ? `{{${key}}}` : match
    })
}

export interface DocumentTypeParameters {
    shortcodes: ShortcodeKey[]
}

export interface DocumentType {
    id: number
    catalogCategoryId?: number
    name: string
    name_translations?: Record<string, string>
    parameters: DocumentTypeParameters
    order?: number | null
    status?: string
}

export interface StatusRecord {
    id: number
    name: string
}

export interface PropertyDocument {
    uuid: string
    propertyUuid: string
    documentType: DocumentType
    content: string | null
    statusRecord: StatusRecord
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

// ── Request payloads ─────────────────────────────────────────────────────

export interface CreatePropertyDocumentPayload {
    propertyDocumentTypeId: number
    statusRecordId: number
    content?: string | null
}

export interface UpdatePropertyDocumentPayload {
    propertyDocumentTypeId?: number
    statusRecordId?: number
    content?: string | null
}

// ── Pagination ───────────────────────────────────────────────────────────

export interface PaginationLinks {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
}

export interface PaginationMeta {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
}

export interface PropertyDocumentListResult {
    items: PropertyDocument[]
    meta: PaginationMeta | null
}

// ── Status constants ───────────────────────────────────────────────────────

export const DOCUMENT_STATUS = {
    ACTIVE: 6,
    INACTIVE: 7,
} as const

/** Returns the localized name for a document type, preferring Spanish. */
export function documentTypeLabel(type: DocumentType, locale: string = "es"): string {
    return type.name_translations?.[locale] || type.name
}
