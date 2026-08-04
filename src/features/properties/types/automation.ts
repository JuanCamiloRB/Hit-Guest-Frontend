/**
 * Property Automations — Types
 * Aligned with /api/v1/property-automations API spec.
 *
 * UUID policy: all public endpoints use UUID. Integer IDs are never exposed.
 * Status:      statusProviderId 8 = active, 10 = inactive (no boolean isActive field).
 */

import type { LucideIcon } from "lucide-react"
import type { ContractType } from "./contract-routing"

// ─── Primitive Types ──────────────────────────────────────────────────

/** 8 = active, 10 = inactive */
export type AutomationStatus = 8 | 10

export type GuestType = "main_guest" | "secondary_guest" | "all"
export type UsageRecordStatus = "pending" | "completed" | "failed"
export type LockType = "unit_entrance" | "building_entrance" | "amenity"

/** Status of an automation for a given reservation (GET /automation-status) */
export type AutomationLiveStatus = "not_started" | "pending" | "completed" | "failed"

// ─── Backend API Types ────────────────────────────────────────────────

/** A single automation record from the backend (property_automations table) */
export interface PropertyAutomation {
  uuid: string                          // UUID7 — used in all endpoint URLs
  propertyUuid: string
  providerId: number | null
  name: string
  guestType: GuestType
  executionOrder: number
  parameters: Record<string, unknown>
  token: string | null
  statusProviderId: AutomationStatus    // 8 = active, 10 = inactive
  deletedAt: string | null
  // Sideloaded relationships (opt-in: ?includeProvider=true / ?includeProperty=true)
  provider?: Provider | null
  property?: unknown | null
  usageRecords?: AutomationUsageRecord[] | null
  // Derived helpers — set by service normalize(), never sent to API
  isActive: boolean                     // = statusProviderId === 8
  providerName?: string | null          // = provider.parameters.slug
  /** @deprecated use executionOrder */
  automationOrder?: number
}

/** Provider record from GET /api/v1/providers */
export interface Provider {
  id: number
  name: string
  description: string | null
  parameters: {
    slug: string
    internalUse: {
      path: string
      tokenName: string
      tokenAbilities: string[]
    }
    billing: { billable: boolean; unit_cost: number }
    /** ISO2 country codes where this provider applies, or ["ALL"]. */
    applicable_countries?: string[]
    /**
     * Present only on signature-capable providers (tufirma, hitguest_signature).
     * `contract_types` is the SOURCE OF TRUTH for which contract_type a
     * provider can sign — never hardcode this per MD §3.2, a third provider
     * could appear without a frontend release if this is read dynamically.
     */
    signature?: {
      /** true = signs inside the portal (native canvas); false = external/async (email). */
      synchronous: boolean
      contract_types: ContractType[]
    }
  }
  order: number
  statusProviderId: number
  integrations?: unknown[] | null
}

/** Providers whose `parameters.signature` is present — the only ones relevant to contract routing. */
export function isSignatureProvider(provider: Provider): boolean {
  return provider.parameters?.signature != null
}

/** Whether `provider` can sign `contractType`, per its own advertised capabilities. */
export function providerSupportsContractType(provider: Provider, contractType: ContractType): boolean {
  return provider.parameters?.signature?.contract_types.includes(contractType) ?? false
}

/**
 * Live automation status for a reservation, from
 * GET /api/v1/reservations/{uuid}/automation-status.
 * One entry per active property automation, ordered by execution_order.
 */
/** Checkin gate required before an automation may be dispatched. */
export type CheckinGate = "reservation" | "main_guest"

export interface AutomationStatusItem {
  automationUuid: string
  automationName: string
  providerSlug: string
  status: AutomationLiveStatus
  lastError: string | null
  lastRunAt: string | null              // "YYYY-MM-DD HH:mm:ss" in America/Bogota
  usageRecordId: number | null          // used for redispatch; null if never run
  contractPdfPath: string | null        // signed contract PDF path (tufirma)
  // ── Backend-provided action flags (dispatch panel contract) ──
  /** true if it ever completed successfully (independent of current status). */
  wasSuccessful: boolean
  lastSuccessAt: string | null          // "YYYY-MM-DD HH:mm:ss" in America/Bogota
  /** Gate required for dispatch; null = no gate. */
  requiresCheckin: CheckinGate | null
  /** Extra gate that applies only to redispatch. */
  redispatchRequiresCheckin: "main_guest" | null
  /** Whether the provider allows manual dispatch/redispatch at all. */
  canManualDispatch: boolean
  reservationCheckinCompleted: boolean
  mainGuestCheckinCompleted: boolean
  /** Authoritative flag for the "Dispatch" button. */
  canDispatch: boolean
  /** Authoritative flag for the "Redispatch" button. */
  canRedispatch: boolean
}

/** Structured error detail for a failed dispatch (automation-records). */
export interface AutomationErrorDetail {
  message: string
  httpStatus: number | null             // external HTTP status; null for non-HTTP errors
  httpBody: string | null               // raw external body; null for non-HTTP errors
}

/** What originated a dispatch attempt (automation-records `triggeredBy`). */
export type AutomationTriggeredBy =
  | "on_checkin_completed"
  | "on_main_guest_checkin_completed"
  | "on_guest_checkin_completed"
  | "after_automation"
  | "manual_dispatch"
  | "manual_redispatch"
  | "manual_resend"

/** Automation execution history entry from GET /api/v1/reservations/{uuid}/automation-records */
export interface AutomationUsageRecord {
  id: number
  status: UsageRecordStatus
  /** Origin of the attempt (automatic trigger or manual action). */
  triggeredBy: AutomationTriggeredBy | string | null
  automationUuid: string | null         // null if automation was permanently deleted
  automationName: string | null
  providerSlug: string | null
  guestUuid: string | null
  billable: boolean
  unitCost: string | null               // decimal string, 4 places
  /** null if not failed; a `{message,...}` object when status === "failed"
   *  (older backends may still send a plain string). */
  lastError: string | AutomationErrorDetail | null
  responsePayload: Record<string, unknown> | null
  createdAt: string                     // "YYYY-MM-DD HH:mm:ss"
  updatedAt: string
}

// ─── Payload Types ────────────────────────────────────────────────────

/** POST /api/v1/property-automations */
export interface PropertyAutomationCreatePayload {
  propertyUuid: string
  providerId?: number | null
  name: string                          // required, max 120 chars
  guestType: GuestType                  // required
  executionOrder?: number               // min 1
  parameters: Record<string, unknown>  // required (can be {})
  statusProviderId: AutomationStatus    // required: 8=active, 10=inactive
}

/**
 * PATCH /api/v1/property-automations/{uuid}
 * All fields optional. NOTE: providerId and propertyUuid cannot be changed here — use configure.
 */
export interface PropertyAutomationUpdatePayload {
  name?: string
  guestType?: GuestType
  executionOrder?: number
  parameters?: Record<string, unknown>
  statusProviderId?: AutomationStatus
}

/**
 * PATCH /api/v1/property-automations/{uuid}/configure
 * Primary endpoint for activation/deactivation and provider-specific config.
 *   Activate:   { statusProviderId: 8, providerId: <id>, parameters: { ... } }
 *   Deactivate: { statusProviderId: 10 }
 * Digital Contract is identified by provider.parameters.signature and cannot
 * be deactivated. Its executionOrder is country-dependent.
 */
export interface PropertyAutomationConfigurePayload {
  statusProviderId: AutomationStatus    // required
  providerId?: number                   // required when activating identity verification (order <= 2)
  parameters?: Record<string, unknown>
}

/** @deprecated Use PropertyAutomationUpdatePayload */
export interface PropertyAutomationPayload extends PropertyAutomationUpdatePayload {
  automationOrder?: number
  providerName?: string | null
}

// ─── Provider Parameter Schemas ───────────────────────────────────────

/** TTLock lock item */
export interface TTLockLock {
  lock_id: number
  name: string
  type: LockType
}

/** TTLock provider parameters (slug: "ttlock") */
export interface TTLockParameters {
  username: string
  password: string
  locks: TTLockLock[]
}

/** PDF Report provider parameters (slug: "pdf-report") */
export interface PdfReportParameters {
  recipients: string[]                  // min 1 valid email
}

/** TRA Colombia provider parameters (slug: "tra-colombia") */
export interface TraColombiaParameters {
  token: string
  rnt: string
}

/** SIRE Colombia provider parameters (slug: "sire-colombia") */
export interface SireColombiaParameters {
  document_type: string
  document_number: string
  password: string
  company_code: string              // NIT o código empresa del que reporta
}

// ─── Frontend UI Definition Types ────────────────────────────────────

/** Schema definition for a parameter field in the config form */
export interface ParameterFieldSchema {
  key: string
  label: string
  type: "text" | "password" | "email" | "select" | "number" | "array" | "string_array" | "textarea"
  required: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  arrayItemSchema?: ParameterFieldSchema[]
  /** For type "string_array": the input type of each scalar item (e.g. "email"). */
  itemType?: "text" | "email"
}

/** A provider option shown in the UI for an automation order */
export interface ProviderOption {
  value: string                         // must match provider.parameters.slug
  label: string
  description: string
  parametersSchema: ParameterFieldSchema[]
  /**
   * Optional known provider id, used as a fallback when the slug can't be resolved
   * from GET /providers (e.g. the record isn't returned by the active-only filter).
   */
  providerId?: number
}

/** Static UI metadata for each automation order (not from API) */
export interface AutomationDefinition {
  order: number
  id: string
  title: string
  description: string
  icon: LucideIcon
  color: string
  bgColor: string
  providerOptions: ProviderOption[]
  guestType: "main" | "secondary" | "all"   // UI label; convert via mapGuestTypeToApi()
  requiresConfig: boolean
  isMandatory: boolean
  /**
   * Parameters that a listing can override from the property-level automation.
   * If undefined or empty, this automation cannot be overridden at the listing level.
   * TTLock → lock_id only; SIRE → company_code; TRA → token + rnt
   */
  listingOverrideSchema?: ParameterFieldSchema[]
}

// ─── Listing Automation Overrides ────────────────────────────────────
//
// A per-listing override for a property-level automation. One override per
// (listing, propertyAutomation) pair. Aligned with the real backend API:
//   GET    /listings/{listingUuid}/automation-overrides?includePropertyAutomation=1
//   GET    /listing-automation-overrides/{uuid}
//   POST   /listing-automation-overrides              (listingUuid in body)
//   PATCH  /listing-automation-overrides/{uuid}
//   DELETE /listing-automation-overrides/{uuid}
//   POST   /listing-automation-overrides/{uuid}/restore
//
// Status (statusRecordId, catalog_category_id = 3): 6 = active, 7 = inactive.

/** 6 = active (override applies), 7 = inactive (automation skipped for this listing) */
export type ListingOverrideStatus = 6 | 7

export const LISTING_OVERRIDE_STATUS = {
  ACTIVE: 6 as ListingOverrideStatus,
  INACTIVE: 7 as ListingOverrideStatus,
} as const

/** Nested property automation, included via ?includePropertyAutomation=1 */
export interface ListingOverridePropertyAutomation {
  uuid: string
  propertyUuid?: string
  providerId?: number | null
  name: string
  guestType?: GuestType
  executionOrder?: number
  parameters: Record<string, unknown> | null   // base params (used to show effective value)
  token?: string | null
  statusProviderId?: number
  provider?: {
    id: number
    name: string
    parameters: {
      slug: string
      internalUse?: { tokenName?: string; tokenAbilities?: string[] }
    }
  } | null
}

export interface ListingAutomationOverride {
  uuid: string
  listingUuid: string
  propertyAutomationUuid: string
  parameters: Record<string, unknown> | null   // delta merged over the automation's base parameters
  token: string | null                          // replaces automation token; null = use automation token
  statusRecordId: ListingOverrideStatus         // 6 = active, 7 = inactive
  deletedAt: string | null
  propertyAutomation?: ListingOverridePropertyAutomation | null
  // Derived helper — set by service normalize(), never sent to API.
  isActive: boolean                             // = statusRecordId === 6
}

/** POST /api/v1/listing-automation-overrides — listingUuid goes in the body. */
export interface ListingAutomationOverrideCreatePayload {
  listingUuid: string
  propertyAutomationUuid: string
  statusRecordId: ListingOverrideStatus
  parameters?: Record<string, unknown> | null
  token?: string | null
}

/** PATCH /api/v1/listing-automation-overrides/{uuid} — all fields optional. */
export interface ListingAutomationOverrideUpdatePayload {
  statusRecordId?: ListingOverrideStatus
  parameters?: Record<string, unknown> | null
  token?: string | null
}

/** Effective parameters for display: base automation params merged with the override delta. */
export function effectiveOverrideParameters(
  override: ListingAutomationOverride,
): Record<string, unknown> {
  return {
    ...(override.propertyAutomation?.parameters ?? {}),
    ...(override.parameters ?? {}),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Map UI guest type labels to API GuestType enum values */
export function mapGuestTypeToApi(guestType: "main" | "secondary" | "all"): GuestType {
  if (guestType === "main") return "main_guest"
  if (guestType === "secondary") return "secondary_guest"
  return "all"
}

// ─── Composite State (for UI) ─────────────────────────────────────────

/** Merged state: definition + live API record (null = not yet created) */
export interface AutomationCardState {
  definition: AutomationDefinition
  automation: PropertyAutomation | null
  isActive: boolean
  providerName: string | null
  isSaving: boolean
}

// ─── Constants ────────────────────────────────────────────────────────

export const AUTOMATION_STATUS = {
  ACTIVE: 8 as AutomationStatus,
  INACTIVE: 10 as AutomationStatus,
} as const

export const AUTOMATION_ORDERS = {
  IDENTITY_VERIFICATION_MAIN: 1,
  IDENTITY_VERIFICATION_SECONDARY: 2,
} as const

export const GUEST_TYPE_LABELS: Record<GuestType, string> = {
  main_guest: "Huésped principal",
  secondary_guest: "Huéspedes secundarios",
  all: "Todos los huéspedes",
}
