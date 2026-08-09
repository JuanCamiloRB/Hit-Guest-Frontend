/**
 * Contract routing — how a property decides which contract text and which
 * signature provider apply to a reservation, per booking channel.
 *
 * Lives in `parameters` of the "Digital Contract" automation (executionOrder
 * 3), separate from `document.ts` on purpose: this is a property of the
 * AUTOMATION (who signs what), while `PropertyDocument` (type 92, Agreement)
 * is just the contract TEXT. The two must stay in "lockstep" — see
 * `contract-routing-sync.ts` — but they are different resources with
 * different endpoints, and conflating them was the previous implementation's
 * mistake (see docs/PLAN_CONTRATOS_POR_SOURCE.md §0).
 */

/** Whether the property uses one contract text for every channel, or one per channel. */
export type ContractMode = "all_sources" | "per_source"

/**
 * What gets signed for a given channel:
 *  - agreement_only            → just the accommodation contract (property_documents text)
 *  - guarantee_only            → just the fixed damage/consumption guarantee HitGuest maintains
 *  - agreement_and_guarantee   → both, concatenated into one PDF, signed in one transaction
 */
export type ContractType = "agreement_only" | "guarantee_only" | "agreement_and_guarantee"

/** The literal key `by_source` uses in `all_sources` mode (never a real source id). */
export const ALL_SOURCES_KEY = "all"

export interface SourceRouting {
    contract_type: ContractType
    provider_slug: string
}

/**
 * The exact shape stored in the Digital Contract automation's `parameters`.
 * Keys of `by_source`: the literal "all" in all_sources mode, or a
 * reservation-source id (as a string) per channel in per_source mode.
 */
export interface ContractRoutingParameters {
    contract_mode: ContractMode
    by_source: Record<string, SourceRouting>
}

/**
 * A property that predates this feature (or one with no automation configured
 * yet) has `parameters: {}` — no `contract_mode`/`by_source` at all. Treat
 * that as "not configured" rather than crashing on missing fields.
 */
export function parseContractRouting(
    parameters: Record<string, unknown> | null | undefined,
): ContractRoutingParameters | null {
    const mode = parameters?.contract_mode
    const bySource = parameters?.by_source
    if ((mode !== "all_sources" && mode !== "per_source") || typeof bySource !== "object" || bySource === null) {
        return null
    }
    return { contract_mode: mode, by_source: bySource as Record<string, SourceRouting> }
}

/** The two contract_type values that need a text in property_documents (MD §1.4). */
export function requiresAgreementDocument(type: ContractType): boolean {
    return type === "agreement_only" || type === "agreement_and_guarantee"
}

/** The two contract_type values that need the HitGuest guarantee annex. */
export function requiresGuaranteeText(type: ContractType): boolean {
    return type === "guarantee_only" || type === "agreement_and_guarantee"
}

/**
 * hitguest_signature can only sign agreement_only (MD §1.2, backend-enforced
 * 422 otherwise). Every other contract_type is tufirma-only. The frontend
 * must not just rely on the 422 — it should not even offer the invalid
 * combination in the UI.
 */
export function isNativeSignatureAllowed(type: ContractType): boolean {
    return type === "agreement_only"
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
    agreement_only: "Contrato de alquiler",
    guarantee_only: "Contrato de garantía",
    agreement_and_guarantee: "Contrato de garantía y alquiler",
}
