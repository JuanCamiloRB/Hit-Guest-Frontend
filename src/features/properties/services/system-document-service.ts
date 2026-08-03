/**
 * System Document Service — read-only access to HitGuest-maintained global
 * document texts (currently: the damage/consumption guarantee annex).
 *
 * Endpoint:
 *   GET /api/v1/system-documents/slug/{slug} → getBySlug
 *
 * These texts are NOT editable from the PM Panel — only HitGuest staff
 * (super_admin / M2M admin:*) can edit them, via a separate internal tool
 * (see docs/PLAN_CONTRATOS_POR_SOURCE.md §5, not built here). The PM Panel
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
     * Per-locale values for the document's own shortcodes (e.g.
     * guarantee_amount). Values are `null` until HitGuest configures them —
     * see `hasUnresolvedShortcodes`.
     */
    extra: Record<string, Record<string, string | null>>
    createdAt: string
    updatedAt: string
}

/**
 * True if the rendered text still has an unsubstituted `{{...}}` token. The
 * guarantee's own shortcodes (guarantee_amount, etc.) are `null` until
 * HitGuest configures them, so the PM should see a warning instead of
 * assuming the previewed text is final (MD §2).
 */
export function hasUnresolvedShortcodes(content: string): boolean {
    return /\{\{[^{}]+\}\}/.test(content)
}

class SystemDocumentService {
    async getBySlug(slug: string): Promise<SystemDocument> {
        return apiClient.get<SystemDocument>(`${API_BASE}/system-documents/slug/${slug}`)
    }
}

export const systemDocumentService = new SystemDocumentService()
