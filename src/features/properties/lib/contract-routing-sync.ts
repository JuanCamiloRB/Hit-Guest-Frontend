/**
 * Contract routing ↔ property_documents "lockstep" sync (backend plan §1.4, §3.5).
 *
 * Pure logic, no React, no fetch — this is where the actual complexity of the
 * feature lives (which document rows must exist before `configure()` can be
 * called, and how to get there from whatever rows exist today), so it is kept
 * isolated and easy to reason about independent of any component.
 *
 * The backend validates `configure()` against the CURRENT state of
 * property_documents at call time (not against what the caller intends), so
 * the documents must be synced first and `configure()` called only after —
 * this module produces that plan, the caller executes it and then configures.
 */

import type { PropertyDocument } from "../types/document"
import { documentChannelId } from "../types/document"
import type { ContractMode, ContractRoutingParameters } from "../types/contract-routing"
import { ALL_SOURCES_KEY, requiresAgreementDocument } from "../types/contract-routing"

export interface DocumentCreate {
    reservationSourceId: number | null
    content: string
}

export interface DocumentUpdate {
    documentUuid: string
    /** Only set when converting a document between modes (assigning/clearing its channel). */
    reservationSourceId?: number | null
    content?: string
}

export interface DocumentSyncPlan {
    creates: DocumentCreate[]
    updates: DocumentUpdate[]
    deletes: string[]
}

/**
 * Infers the property's current mode from its type-92 documents (backend
 * plan §3.3 — there is no explicit "mode" field anywhere, it's inferred from
 * this list). `null` = no Agreement documents at all yet ("not configured").
 */
export function detectMode(currentDocs: PropertyDocument[]): ContractMode | null {
    if (currentDocs.length === 0) return null
    return currentDocs.some((d) => documentChannelId(d) == null) ? "all_sources" : "per_source"
}

/**
 * Builds the ordered create/update/delete sequence that takes
 * `property_documents` from `currentDocs` to whatever `desired` needs, per
 * the four transitions the backend plan §3.5 describes. Converts a document
 * to its new channel instead of delete+create when one is available to
 * convert, so there's never a moment with zero agreement documents.
 *
 * `texts`: desired content keyed by the SAME by_source key ("all" or a
 * source id as a string) — the form field the PM is editing for that channel.
 * A channel that needs an agreement document but has no text yet gets "".
 */
export function planDocumentSync(
    currentDocs: PropertyDocument[],
    desired: ContractRoutingParameters,
    texts: Record<string, string>,
): DocumentSyncPlan {
    const creates: DocumentCreate[] = []
    const updates: DocumentUpdate[] = []
    const deletes: string[] = []

    const nullDoc = currentDocs.find((d) => documentChannelId(d) == null) ?? null
    const neededKeys = Object.entries(desired.by_source)
        .filter(([, routing]) => requiresAgreementDocument(routing.contract_type))
        .map(([key]) => key)

    if (desired.contract_mode === "all_sources") {
        // Any leftover per-source rows are from a prior per_source configuration
        // and must go — a per_source → all_sources transition (§3.5). One of
        // them may get converted below instead of deleted.
        for (const doc of currentDocs) {
            if (documentChannelId(doc) != null) deletes.push(doc.uuid)
        }

        if (!neededKeys.includes(ALL_SOURCES_KEY)) {
            // The single "all" channel is guarantee_only — no agreement text
            // needed. A leftover all_sources doc is harmless (§1.4) and is left as-is.
            return { creates, updates, deletes }
        }

        const content = texts[ALL_SOURCES_KEY] ?? ""
        if (nullDoc) {
            if (nullDoc.content !== content) updates.push({ documentUuid: nullDoc.uuid, content })
        } else {
            const toConvert = currentDocs.find((d) => documentChannelId(d) != null)
            if (toConvert) {
                const i = deletes.indexOf(toConvert.uuid)
                if (i >= 0) deletes.splice(i, 1)
                updates.push({ documentUuid: toConvert.uuid, reservationSourceId: null, content })
            } else {
                creates.push({ reservationSourceId: null, content })
            }
        }
        return { creates, updates, deletes }
    }

    // per_source
    let convertedNullDoc = false
    for (const key of neededKeys) {
        const sourceId = Number(key)
        const existing = currentDocs.find((d) => documentChannelId(d) === sourceId)
        const content = texts[key] ?? ""

        if (existing) {
            if (existing.content !== content) updates.push({ documentUuid: existing.uuid, content })
        } else if (nullDoc && !convertedNullDoc) {
            // Convert the single all_sources doc into the first channel that
            // needs one — the recommended all_sources → per_source path (§3.5).
            updates.push({ documentUuid: nullDoc.uuid, reservationSourceId: sourceId, content })
            convertedNullDoc = true
        } else {
            creates.push({ reservationSourceId: sourceId, content })
        }
    }
    // The all_sources doc wasn't needed by any channel (e.g. every channel is
    // guarantee_only) — nothing to convert it into, so it must be removed;
    // leaving it would trip the "per_source but a null-source row exists" 422.
    if (nullDoc && !convertedNullDoc) deletes.push(nullDoc.uuid)

    // Channels present in currentDocs but no longer in `neededKeys` (switched
    // to guarantee_only, or removed from by_source entirely) keep their row
    // untouched — the backend plan explicitly allows an unused document to
    // remain (§1.4); offering to delete it is a UI decision, not this plan's.

    return { creates, updates, deletes }
}

/**
 * by_source keys that need agreement text but have none typed yet — the
 * pre-save warning from the backend plan §3.6 ("canal sin configurar").
 *
 * Deliberately checks `texts`, not `currentDocs`: `planDocumentSync` will
 * happily CREATE a document row for a channel that has no row yet, using
 * whatever is in `texts` (even ""). A row existing is not what the PM needs
 * to see before saving — an EMPTY contract is. So this reports blank text
 * for a required channel, which is the one gap that's fully knowable on the
 * client and actually prevents a PM from publishing an empty contract.
 */
export function findLockstepGaps(
    desired: ContractRoutingParameters,
    texts: Record<string, string>,
): string[] {
    return Object.entries(desired.by_source)
        .filter(([, routing]) => requiresAgreementDocument(routing.contract_type))
        .map(([key]) => key)
        .filter((key) => !texts[key]?.trim())
}
