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
 * Cómo se organizan los TEXTOS, independiente de cómo se firma:
 *  - `shared`: un solo texto sin canal (`reservationSourceId: null`) para todos.
 *  - `per_channel`: un texto por canal.
 *
 * Con `all_sources` siempre es `shared`. Con `per_source` puede ser cualquiera
 * de los dos (contrato 2026-10-19 §2.4 bis: el texto general sirve a todos los
 * canales aunque cada uno firme distinto). Lo que el backend NO admite es
 * mezclarlos. Importa desde el contrato 2026-10-20: los textos de las unidades
 * siguen el modo de los textos de la propiedad, así que convertir el texto
 * general sin necesidad deja sin efecto los de las unidades.
 */
export type ContractTextMode = "shared" | "per_channel"

/** Modo de los textos de la propiedad según sus documentos; `null` si no hay ninguno. */
export function detectTextMode(currentDocs: PropertyDocument[]): ContractTextMode | null {
    if (currentDocs.length === 0) return null
    // Con textos por canal manda ese modo; un general sobrante es un resto que
    // el backend ya no admite junto a ellos.
    return currentDocs.some((d) => documentChannelId(d) != null) ? "per_channel" : "shared"
}

/** El modo de textos efectivo: `all_sources` siempre usa el texto general. */
export function effectiveTextMode(mode: ContractMode, textMode: ContractTextMode): ContractTextMode {
    return mode === "all_sources" ? "shared" : textMode
}

/** La clave de `texts` que guarda el texto que firma ese canal. */
export function textKeyFor(mode: ContractMode, textMode: ContractTextMode, channelKey: string): string {
    return effectiveTextMode(mode, textMode) === "shared" ? ALL_SOURCES_KEY : channelKey
}

/** Claves de `texts` que deben tener texto: las de los canales que firman contrato de alquiler. */
export function requiredTextKeys(desired: ContractRoutingParameters, textMode: ContractTextMode): string[] {
    const keys = Object.entries(desired.by_source)
        .filter(([, routing]) => requiresAgreementDocument(routing.contract_type))
        .map(([key]) => textKeyFor(desired.contract_mode, textMode, key))
    return Array.from(new Set(keys))
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
    textMode: ContractTextMode = "per_channel",
): DocumentSyncPlan {
    const creates: DocumentCreate[] = []
    const updates: DocumentUpdate[] = []
    const deletes: string[] = []

    const nullDoc = currentDocs.find((d) => documentChannelId(d) == null) ?? null
    const neededKeys = requiredTextKeys(desired, textMode)

    // Un solo texto general: `all_sources`, o `per_source` con texto compartido
    // (contrato 2026-10-19 §2.4 bis). Mismas reglas en los dos casos.
    if (effectiveTextMode(desired.contract_mode, textMode) === "shared") {
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
    textMode: ContractTextMode = "per_channel",
): string[] {
    return requiredTextKeys(desired, textMode).filter((key) => !texts[key]?.trim())
}

/**
 * ¿Lo que el servidor devolvió después de guardar es lo que se envió?
 *
 * Se confirma lo que el bug de las claves 0/1/2 rompe: modo y routing por canal
 * EXACTOS (orden de claves aparte), y un documento de contrato para cada canal
 * que lo necesita. El TEXTO no se compara carácter a carácter: el backend puede
 * normalizar el HTML al guardar, y un canal solo-garantía no tiene documento;
 * compararlos daba un falso «devolvió algo distinto» tras un guardado correcto.
 */
export function isSaveConfirmed(
    sent: ContractRoutingParameters,
    confirmed: ContractRoutingParameters,
    documentChannelKeys: ReadonlySet<string>,
    textMode: ContractTextMode = "per_channel",
): boolean {
    const sorted = (routing: ContractRoutingParameters["by_source"]) =>
        JSON.stringify(Object.entries(routing).sort(([a], [b]) => a.localeCompare(b)))
    if (sent.contract_mode !== confirmed.contract_mode) return false
    if (sorted(sent.by_source) !== sorted(confirmed.by_source)) return false
    return requiredTextKeys(confirmed, textMode).every((key) => documentChannelKeys.has(key))
}
