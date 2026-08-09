/**
 * Integrations — Types (Kunas PMS)
 *
 * Mirrors the backend IntegrationResource. The API already returns camelCase and
 * `apiClient` unwraps the `{ data }` envelope, so these types describe the inner
 * object directly.
 *
 * Security note: `token` (root) is HIT's internal id and `parameters.token` is
 * the provider token — neither is shown to the PM. `parameters.password` is
 * never returned. See the API contract for details.
 */

/** statusProviderId values. 8 = active, 10 = inactive. */
export const INTEGRATION_STATUS = {
    ACTIVE: 8,
    INACTIVE: 10,
} as const

export type IntegrationStatus =
    (typeof INTEGRATION_STATUS)[keyof typeof INTEGRATION_STATUS]

/** A property imported from the PMS (may be empty while sync is in progress). */
export interface PmsProperty {
    id: string
    name: string
}

export interface IntegrationParameters {
    /** Provider token (internal — do not surface to the PM). */
    token?: string
    /** The KunasPMS account email — safe to display. */
    email?: string
    /** Properties synced from the PMS; `[]` until the async sync completes. */
    pmsProperties?: PmsProperty[]
}

/**
 * The integration resource.
 *
 * ⚠️ The published `IntegrationResource` doc still shows `id` and `userId`, but
 * the LIVE response returns neither — it returns `userUuid` instead. That gap is
 * exactly what produced `PATCH /integrations/undefined → 404`: the old type
 * declared `id: number`, TypeScript happily type-checked `integration.id`, and
 * the missing field interpolated as the string "undefined" at runtime.
 *
 * Rule this type now follows: only `token` is declared as guaranteed, because it
 * is the only field the frontend actually consumes AND it is confirmed present
 * in the live payload. Everything the frontend does not consume stays optional,
 * so a doc/response mismatch can never again become a runtime bug.
 */
export interface Integration {
    /**
     * HIT internal identifier, and the id used to address this integration in
     * `/integrations/{id}` — the route takes this alphanumeric token in place of
     * the numeric id. NOT `parameters.token`, which is the KunasPMS provider
     * key. Neither is ever surfaced to the PM.
     */
    token: string
    providerId: number
    name: string
    parameters: IntegrationParameters
    statusProviderId: IntegrationStatus
    /** Present in the live response; absent from the published doc. Unused. */
    userUuid?: string
    /** In the published doc; absent from the live response. Unused — never address by it. */
    id?: number
    /** In the published doc; absent from the live response. Unused. */
    userId?: number
}

// ─── Payloads ──────────────────────────────────────────────────────────────

/** POST /kunas-pms/connect */
export interface KunasConnectPayload {
    token: string
    email: string
    password: string
    /** Optional descriptive name (default "KunasPMS"). */
    name?: string
}

/** PATCH /kunas-pms/configuration — updates stored credentials, no re-sync. */
export interface KunasConfigurationPayload {
    email: string
    password: string
    /**
     * Optional new provider token. Omitted when the PM leaves the field blank
     * (keeps the current token). Requires backend support on /configuration.
     */
    token?: string
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

export function isActive(integration: Integration | null): boolean {
    return integration?.statusProviderId === INTEGRATION_STATUS.ACTIVE
}
