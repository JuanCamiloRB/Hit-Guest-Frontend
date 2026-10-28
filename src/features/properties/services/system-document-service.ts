/**
 * System Document Service — read-only access to HitGuest-maintained global
 * document texts (currently: the damage/consumption guarantee annex).
 *
 * Endpoint:
 *   GET /api/v1/system-documents/slug/{slug} → getBySlug
 *
 * These texts are NOT editable from the PM Panel — only HitGuest staff
 * (super_admin / M2M admin:*) can edit them, via a separate internal tool
 * (contract plan §5, not built here). The PM Panel
 * only previews this text while configuring contract_type.
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

export const GUARANTEE_DOCUMENT_SLUG = "damage_consumption_guarantee"

export interface SystemDocument {
    uuid: string
    slug: string
    /** Raw template per locale — shortcodes come UNRESOLVED (e.g. {{guest_first_name}}). */
    content: Record<string, string>
    /**
     * Valores por idioma de las variables PROPIAS del documento, configurados
     * en la DB de HitGuest (p. ej. `guarantee_amount: "1000"`). HitGuest los
     * reemplaza al generar el PDF; el panel los usa solo para previsualizar.
     */
    extra: Record<string, Record<string, string | null> | undefined>
    createdAt: string
    updatedAt: string
}

/**
 * Las ÚNICAS variables que el panel resuelve en la vista de configuración
 * (Ricardo, 2026-10-29): las de la garantía, que vienen en `extra[idioma]`.
 * Las demás (huésped, reserva, propiedad) son de cada reserva: las resuelve
 * HitGuest al generar el PDF y se dejan tal cual.
 */
export const GUARANTEE_PREVIEW_VARIABLES: ReadonlySet<string> = new Set([
    "guarantee_mechanism",
    "guarantee_amount",
    "guarantee_release_hours",
    "damage_catalog_url",
])

export interface GuaranteePreviewResult {
    html: string
    /** Variables de la garantía que el texto usa y que no vinieron configuradas. */
    missing: string[]
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

/** Un valor usable; la URL del catálogo solo si es http(s) (va dentro de un `href`). */
function usableValue(key: string, value: unknown): string | null {
    if (typeof value !== "string" || value.trim() === "") return null
    const trimmed = value.trim()
    if (key === "damage_catalog_url" && !/^https?:\/\//i.test(trimmed)) return null
    return trimmed
}

/**
 * Sustituye en `content` SOLO las variables de la garantía con sus valores de
 * `values` (el `extra` del MISMO idioma), escapados. Las que falten quedan como
 * token y se informan en `missing`; cualquier otra variable queda intacta.
 */
export function resolveGuaranteePreview(
    content: string,
    values: Record<string, string | null> | undefined,
): GuaranteePreviewResult {
    const missing = new Set<string>()
    const html = content.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (token, rawKey: string) => {
        const key = rawKey.toLowerCase()
        if (!GUARANTEE_PREVIEW_VARIABLES.has(key)) return token
        const value = usableValue(key, values?.[key])
        if (value === null) {
            missing.add(key)
            return token
        }
        return escapeHtml(value)
    })
    return { html, missing: Array.from(missing) }
}

class SystemDocumentService {
    async getBySlug(slug: string): Promise<SystemDocument> {
        return apiClient.get<SystemDocument>(`${API_BASE}/system-documents/slug/${slug}`)
    }
}

export const systemDocumentService = new SystemDocumentService()
