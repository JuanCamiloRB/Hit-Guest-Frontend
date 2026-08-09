/**
 * External PMS identifiers — the `{ origen, id externo }` pair that links a
 * property or a listing created manually in HitGuest with its counterpart in the
 * PMS / channel it really lives in.
 *
 * Backend contract (verified against the live API, not inferred):
 *   - Request  (POST/PUT `/properties`, POST/PUT `/listings`):
 *       `externalPmsIds: [{ sourcePmsId: number, externalId: string }]`
 *       `sourcePmsId` must exist in catalogs with `catalog_category_id = 12`
 *       (`source_pms`); no duplicated source in the same request; `externalId`
 *       max 60 chars.
 *   - Response: properties return them as `pmsIdentifiers`. The field name on a
 *     listing response is NOT confirmed against a live payload, which is exactly
 *     why `normalizeExternalPmsIds` reads every plausible key instead of picking
 *     one — the same tolerant-read style the rest of this feature already uses
 *     for `internalName`/`internal_name`.
 */

import type { ExternalPmsId } from "../types"

/** Catalog category that holds the PMS/channel sources (`source_pms`). */
export const SOURCE_PMS_CATALOG_CATEGORY_ID = 12

/** Backend limit for `externalPmsIds[].externalId`. */
export const EXTERNAL_ID_MAX_LENGTH = 60

/** The keys an API response may carry the identifiers under, most likely first. */
const RESPONSE_KEYS = ["pmsIdentifiers", "externalPmsIds", "external_identifiers"] as const

function toEntry(raw: unknown): ExternalPmsId | null {
    if (!raw || typeof raw !== "object") return null
    const item = raw as Record<string, unknown>
    const sourcePmsId = Number(item.sourcePmsId ?? item.source_pms_id)
    const externalId = String(item.externalId ?? item.external_id ?? "").trim()
    if (!Number.isInteger(sourcePmsId) || sourcePmsId <= 0 || !externalId) return null
    return { sourcePmsId, externalId }
}

/**
 * Reads the external identifiers off a property or listing API response.
 *
 * Drops entries the form could not round-trip anyway (missing source, empty id),
 * so an incomplete row from the API never becomes an invalid payload on save.
 * Returns `[]` for anything unrecognizable — never throws on a shape surprise.
 */
export function normalizeExternalPmsIds(source: unknown): ExternalPmsId[] {
    if (!source || typeof source !== "object") return []
    const record = source as Record<string, unknown>

    for (const key of RESPONSE_KEYS) {
        const value = record[key]
        if (!Array.isArray(value)) continue
        const entries = value.map(toEntry).filter((entry): entry is ExternalPmsId => entry !== null)
        if (entries.length > 0) return entries
    }
    return []
}

/**
 * True when a row is still missing its source or its id — the state a freshly
 * added row starts in. Both the property form and the unit dialog block saving
 * on this, so the rule lives here once instead of in each of them.
 */
export function hasIncompleteExternalPmsId(rows: ExternalPmsId[] | undefined): boolean {
    return (rows ?? []).some(
        (row) => !row.sourcePmsId || !String(row.externalId ?? "").trim(),
    )
}

/**
 * The payload form: trimmed ids, incomplete rows dropped.
 *
 * Always returns an array — including the empty one. Omitting the key when the
 * PM removes their last mapping would leave the removal unexpressible, so the
 * intent is sent explicitly.
 */
export function toExternalPmsIdsPayload(rows: ExternalPmsId[] | undefined): ExternalPmsId[] {
    return (rows ?? [])
        .filter((row) => row.sourcePmsId && String(row.externalId ?? "").trim())
        .map((row) => ({
            sourcePmsId: Number(row.sourcePmsId),
            externalId: String(row.externalId).trim(),
        }))
}
