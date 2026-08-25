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

const CONTRACT_TYPES = new Set<ContractType>(["agreement_only", "guarantee_only", "agreement_and_guarantee"])

function isSourceRouting(value: unknown): value is SourceRouting {
    if (typeof value !== "object" || value === null) return false
    const candidate = value as Partial<SourceRouting>
    return CONTRACT_TYPES.has(candidate.contract_type as ContractType) && typeof candidate.provider_slug === "string"
}

/**
 * Enforces the backend invariant that the two routing modes cannot be mixed.
 * Persisted legacy data may contain both `all` and numeric source keys; the UI
 * must never carry those hidden keys into the next configure() request.
 */
export function routingForMode(
    mode: ContractMode,
    bySource: Record<string, SourceRouting>,
    allowedSourceIds?: ReadonlySet<number>,
): Record<string, SourceRouting> {
    if (mode === "all_sources") {
        return isSourceRouting(bySource[ALL_SOURCES_KEY]) ? { [ALL_SOURCES_KEY]: bySource[ALL_SOURCES_KEY] } : {}
    }

    return Object.fromEntries(
        Object.entries(bySource).filter(([key, routing]) => {
            if (key === ALL_SOURCES_KEY || !isSourceRouting(routing)) return false
            const sourceId = Number(key)
            return (
                Number.isInteger(sourceId) &&
                sourceId > 0 &&
                (allowedSourceIds === undefined || allowedSourceIds.has(sourceId))
            )
        }),
    )
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
    return {
        contract_mode: mode,
        by_source: bySource as Record<string, SourceRouting>,
    }
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

/**
 * Resumen de solo lectura del routing, para que la tarjeta de Contrato
 * MUESTRE quién firma en vez de volver a preguntarlo.
 *
 * `by_source[].provider_slug` es la única respuesta real a "quién firma": es lo
 * que valida `providerSupportsContractType` y lo que consume el portal del
 * huésped (`signingProvider`). El `provider_id` de la fila de automatización no
 * decide nada, así que un selector propio en la tarjeta solo podía contradecir
 * a esta pantalla — o peor, ofrecer la firma nativa para una garantía, que el
 * backend rechaza con 422.
 */
/** Un canal del routing, tal como se persiste — para MOSTRARLO, no editarlo. */
export interface ContractRoutingChannel {
    /** `"all"` en all_sources; el id del canal (como string) en per_source. */
    sourceKey: string
    contractType: ContractType
    /** `null` cuando el canal quedó guardado sin firmante. */
    providerSlug: string | null
}

export interface ContractRoutingSummary {
    mode: ContractMode
    /** Cantidad de canales con routing válido. */
    channelCount: number
    /** Solo en `all_sources`: qué se firma en el único canal. */
    contractType: ContractType | null
    /** Solo en `all_sources`: quién firma, en slug (el consumidor lo traduce). */
    providerSlug: string | null
    /**
     * Detalle por canal en el orden persistido. Existe porque "N canales
     * configurados" no le dice al PM QUÉ tiene activo — la tarjeta debe poder
     * enumerar canal · tipo de contrato · firmante sin volver a Documentos.
     */
    channels: ContractRoutingChannel[]
}

/** `null` cuando la automatización todavía no tiene routing configurado. */
export function summarizeContractRouting(
    parameters: Record<string, unknown> | null | undefined,
): ContractRoutingSummary | null {
    const parsed = parseContractRouting(parameters)
    if (!parsed) return null

    const routes = routingForMode(parsed.contract_mode, parsed.by_source)
    const entries = Object.values(routes)
    if (entries.length === 0) return null

    const single = parsed.contract_mode === "all_sources" ? entries[0] : null
    return {
        mode: parsed.contract_mode,
        channelCount: entries.length,
        contractType: single?.contract_type ?? null,
        providerSlug: single?.provider_slug || null,
        channels: Object.entries(routes).map(([sourceKey, routing]) => ({
            sourceKey,
            contractType: routing.contract_type,
            providerSlug: routing.provider_slug || null,
        })),
    }
}


export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
    agreement_only: "Contrato de alquiler",
    guarantee_only: "Contrato de garantía",
    agreement_and_guarantee: "Contrato de garantía y alquiler",
}

export const CONTRACT_TYPE_OWNERS: Record<ContractType, string> = {
    agreement_only: "Usuario",
    guarantee_only: "HIT · no editable",
    agreement_and_guarantee: "Garantía HIT · alquiler del usuario",
}
