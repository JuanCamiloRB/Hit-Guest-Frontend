/**
 * Billing / Consumption — Types
 *
 * The Operations Dashboard (Tablero) shows, per reservation, how much each
 * automation consumed, plus the account balance and a way to top it up.
 *
 * Per-reservation cost is derived from REAL usage records:
 *   GET /api/v1/reservations/{uuid}/automation-records  → unitCost + billable
 * Account balance + recharge are not wired on the backend yet; see
 * billing-service.ts for the expected endpoints. The payment provider is a
 * backend detail — the frontend only opens the returned payment URL.
 */

/** The billable automation buckets we surface on the dashboard. */
export type CostCategory = "checkin" | "contract" | "tra" | "sire" | "access"

/** One line in a reservation's cost breakdown (a single billable category). */
export interface CostLineItem {
    category: CostCategory
    label: string
    /** Amount consumed for this category, in USD. */
    amount: number
    /** How many billable records rolled up into this line. */
    count: number
    /** True once at least one billable record exists for this category. */
    consumed: boolean
}

/** An automation node and how many times it ran successfully. */
export interface NodeUsage {
    /** Automation name as configured on the property, e.g. "TRA Colombia". */
    name: string
    /** Successful executions. */
    runs: number
}

/** Full cost breakdown for a single reservation. */
export interface ReservationCost {
    reservationId: string
    guestName: string
    unitName: string
    propertyName: string
    checkIn: Date
    /** Ordered line items, one per known category (always the same 5). */
    lineItems: CostLineItem[]
    /** Sum of all line-item amounts, in USD. */
    total: number
    /**
     * Successful runs per automation node — including non-billable ones (PDF
     * report, check-in link), which the cost line items deliberately exclude.
     */
    nodeRuns: NodeUsage[]
}

/** One month of the consumption history chart. */
export interface MonthlyPoint {
    /** First day of the month. */
    date: Date
    /** Total consumed that month, in USD. */
    total: number
}

/** KPIs for a single reference month. */
export interface ConsumptionSummary {
    /** Total consumed in the reference month, in USD. */
    monthTotal: number
    /** Total consumed the month before, in USD — the baseline for the delta. */
    prevMonthTotal: number
    /** Month-over-month change as a fraction (0.1 → +10%); null with no baseline. */
    monthDeltaPct: number | null
    /** Reservations in the month with at least one billable charge. */
    billedReservations: number
    /** Average cost per billed reservation in the month, in USD. */
    avgPerReservation: number
    /** Guests verified in the month (successful identity-verification charges). */
    verifiedGuests: number
    /** Grand total across all loaded reservations, in USD. */
    grandTotal: number
}

/** Everything the Tablero renders for a given month. */
export interface ConsumptionAnalytics {
    summary: ConsumptionSummary
    /** Six months ending at the reference month, oldest first. */
    monthly: MonthlyPoint[]
    /** Nodes executed in the reference month, most-run first. */
    topNodes: NodeUsage[]
}

/** Account prepaid balance ("bolsa"). */
export interface AccountBalance {
    /** Current balance amount. */
    amount: number
    /** ISO currency code, e.g. "USD". */
    currency: string
}

// ─── Balance state ────────────────────────────────────────────────────────

/** Below (and including) this USD balance we warn the PM. */
export const LOW_BALANCE_THRESHOLD = 5

export type BalanceState = "normal" | "low" | "depleted"

/** Classifies a balance for the widget/banner styling. `null` → treated as 0. */
export function getBalanceState(amount: number | null | undefined): BalanceState {
    const value = Number(amount ?? 0)
    if (value <= 0) return "depleted"
    if (value <= LOW_BALANCE_THRESHOLD) return "low"
    return "normal"
}

/**
 * The single USD formatter for the whole billing feature: `"1.234,56 USD"`.
 *
 * Deliberately NOT `$1,234.56`: in Colombia — the product's home market — `$` is
 * the peso sign, so a dollar amount written that way reads as COP. The suffix is
 * explicit instead. This lives here, in the dependency-free module, so the header
 * balance widget can use it without pulling an API service into every page bundle.
 */
export function formatUsd(amount: number | null | undefined): string {
    const formatted = Number(amount ?? 0).toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
    return `${formatted} USD`
}

// ─── Recharge packages (GET /billing/packages) ─────────────────────────────

export interface BillingPackage {
    /** Credit amount in USD. */
    amount: number
    /** Short display label, e.g. "$25". */
    label: string
    /** Longer description, e.g. "25 USD credits". */
    description: string
}

export interface PackagesInfo {
    packages: BillingPackage[]
    /** Minimum allowed custom top-up amount, in USD. */
    minimumCustom: number
    currency: string
}

// ─── Checkout (POST /billing/checkout) ─────────────────────────────────────

export interface CheckoutResult {
    /** Hosted Stripe Checkout URL to redirect the PM to. */
    checkoutUrl: string
    sessionId: string
}

// ─── Credit transactions (GET /billing/transactions) ───────────────────────

export type TransactionType = "credit" | "debit"
export type TransactionSource =
    | "trial"
    | "stripe"
    | "automation"
    | "automation_refund"
    | "manual"
export type TransactionStatus = "completed" | "refunded"

export interface CreditTransaction {
    uuid: string
    type: TransactionType
    amount: number
    balanceAfter: number
    description: string
    source: TransactionSource | string
    paymentGateway: string | null
    status: TransactionStatus | string
    /** ISO 8601 with timezone, e.g. "2026-07-10T14:32:15+00:00". */
    createdAt: string
}

/** A normalized page of transactions (from Laravel's paginated envelope). */
export interface TransactionsPage {
    data: CreditTransaction[]
    currentPage: number
    lastPage: number
    perPage: number
    total: number
    from: number
    to: number
}
