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

export interface Integration {
    id: number
    userId: number
    providerId: number
    name: string
    /** HIT internal identifier — do not surface to the PM. */
    token: string
    parameters: IntegrationParameters
    statusProviderId: IntegrationStatus
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
