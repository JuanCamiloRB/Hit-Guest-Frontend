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
 * mistake (contract plan §0, `git show b3b0df9:docs/PLAN_CONTRATOS_POR_SOURCE.md`).
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
 * Las entradas de `by_source` cuya clave NO corresponde a ningún canal del
 * catálogo (`GET /reservation-sources`).
 *
 * `routingForMode` las descarta al hidratar — correcto para el payload (nunca
 * reenviar un id que el catálogo no respalda) — pero descartarlas EN SILENCIO
 * producía «lo veo en la tarjeta y no existe donde se edita»: la tarjeta de
 * Automatizaciones muestra el routing crudo («Canal 1 · …», nunca oculta lo que
 * el backend tiene) y la pestaña Documentos no dejaba ni rastro (caso real,
 * 2026-09-03, `by_source["1"]` con el catálogo en 21/22/23). Quien hidrata usa
 * esto para AVISAR qué quedó fuera en vez de callarlo.
 */
export function orphanRoutingEntries(
    bySource: Record<string, SourceRouting> | undefined,
    allowedSourceIds: ReadonlySet<number>,
): Array<{ sourceKey: string; routing: SourceRouting }> {
    return Object.entries(bySource ?? {})
        .filter((entry): entry is [string, SourceRouting] => {
            const [key, routing] = entry
            if (key === ALL_SOURCES_KEY || !isSourceRouting(routing)) return false
            const sourceId = Number(key)
            return !Number.isInteger(sourceId) || sourceId <= 0 || !allowedSourceIds.has(sourceId)
        })
        .map(([sourceKey, routing]) => ({ sourceKey, routing }))
}

/**
 * `by_source` llegó como LISTA JSON: el bug del backend (corregido el
 * 2026-10-19) que convertía en lista un objeto con claves numéricas al
 * responder. Las posiciones 0, 1, 2 no son canales y no hay forma de saber cuál
 * era cuál; guardar encima reemplazaría el routing real. Es la única forma
 * del dato que bloquea la edición — una clave de objeto desconocida no.
 */
export function bySourceArrivedAsList(parameters: Record<string, unknown> | null | undefined): boolean {
    return Array.isArray(parameters?.by_source)
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


/**
 * `contractRouting`: el ruteo ya leído canal por canal por el backend
 * (contrato 2026-10-19). Viene solo en la automation de firma y en el override
 * de una unidad sobre ella, con los textos en el idioma del request. El front
 * lo PINTA; no vuelve a armar «Canal N · …» desde `by_source`.
 */
export interface ContractRoutingChannelView {
    /** `"all"` o el id del canal como string — la misma clave de `by_source`. */
    key: string
    channel: { id: number | null; slug: string | null; name: string }
    contractTypeLabel: string
    provider: { slug: string; label: string; signsInPortal: boolean } | null
    /**
     * `ready` · `missing_document` · `unknown_channel` · `provider_unavailable`.
     * Se guarda tal cual: un valor que el front no conoce cuenta como «no está
     * listo» (falla cerrado) y se muestra su `statusLabel`.
     */
    status: string
    statusLabel: string
    summary: string
}

export interface ContractRoutingView {
    modeLabel: string
    /** En el orden del catálogo de canales, no en el guardado. */
    channels: ContractRoutingChannelView[]
    /** Algún canal no está `ready`. */
    needsAttention: boolean
    /** Solo en el override de una unidad: el contrato está apagado en ella. */
    disabled: boolean
    /** Solo en el override: `listing` = ruteo propio · `property` = hereda. */
    routingSource: "listing" | "property" | null
}

function text(value: unknown): string {
    return typeof value === "string" ? value : ""
}

function readChannelView(raw: unknown): ContractRoutingChannelView | null {
    if (typeof raw !== "object" || raw === null) return null
    const item = raw as Record<string, unknown>
    const key = typeof item.key === "string" || typeof item.key === "number" ? String(item.key) : ""
    if (!key) return null
    const channel = typeof item.channel === "object" && item.channel !== null ? item.channel as Record<string, unknown> : {}
    const provider = typeof item.provider === "object" && item.provider !== null ? item.provider as Record<string, unknown> : null
    return {
        key,
        channel: {
            id: typeof channel.id === "number" ? channel.id : null,
            slug: typeof channel.slug === "string" && channel.slug ? channel.slug : null,
            name: text(channel.name) || key,
        },
        contractTypeLabel: text(item.contractTypeLabel),
        provider: provider
            ? { slug: text(provider.slug), label: text(provider.label) || text(provider.name), signsInPortal: provider.signsInPortal === true }
            : null,
        status: text(item.status),
        statusLabel: text(item.statusLabel),
        summary: text(item.summary),
    }
}

/** `null` cuando el backend no lo mandó (o no es un objeto): quien pinta usa el `by_source` crudo. */
export function readContractRouting(raw: unknown): ContractRoutingView | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
    const view = raw as Record<string, unknown>
    const channels = (Array.isArray(view.channels) ? view.channels : [])
        .map(readChannelView)
        .filter((channel): channel is ContractRoutingChannelView => channel !== null)
    return {
        modeLabel: text(view.modeLabel),
        channels,
        needsAttention: view.needsAttention === true || channels.some((channel) => channel.status !== "ready"),
        disabled: view.disabled === true,
        routingSource: view.routingSource === "listing" || view.routingSource === "property" ? view.routingSource : null,
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
