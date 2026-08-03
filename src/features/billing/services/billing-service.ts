/**
 * Billing service — prepaid account balance + Stripe-hosted top-ups.
 *
 * Endpoints (all require the PM's session token, attached by apiClient):
 *   GET  /api/v1/billing/balance        → { balance, currency }
 *   GET  /api/v1/billing/packages       → { packages[], minimumCustom, currency }
 *   POST /api/v1/billing/checkout       → { checkoutUrl, sessionId }   body: { amount }
 *   GET  /api/v1/billing/transactions?page=n → Laravel paginated { data, meta, links }
 *
 * The payment provider (Stripe) is a BACKEND concern: the frontend only opens the
 * returned `checkoutUrl` and never talks to Stripe directly.
 *
 * `getBalance` returns `null` on a 404/501 so the UI can render a "pending" state
 * while the backend route ships, instead of a fake $0.
 */

import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { ApiError } from "@/types/api"
import type {
    AccountBalance,
    BillingPackage,
    CheckoutResult,
    CreditTransaction,
    PackagesInfo,
    TransactionsPage,
} from "../types"

/** Thrown when a billing endpoint isn't available on the backend yet. */
export class BillingNotConfiguredError extends Error {
    constructor(message = "Billing backend not configured yet") {
        super(message)
        this.name = "BillingNotConfiguredError"
    }
}

/** A 404/501 means the route isn't implemented server-side yet. */
function isNotImplemented(error: unknown): boolean {
    return error instanceof ApiError && (error.status === 404 || error.status === 501)
}

/** Balance payload — tolerates `balance` (spec) or legacy `amount`, raw or `{ data }`. */
interface BalanceResponse {
    balance?: number
    amount?: number
    currency?: string
    data?: { balance?: number; amount?: number; currency?: string }
}

interface CheckoutResponse {
    checkoutUrl?: string
    sessionId?: string
    data?: { checkoutUrl?: string; sessionId?: string }
}

class BillingService {
    /**
     * Current prepaid balance. `null` when the endpoint isn't available yet
     * (404/501) so the UI shows a pending state; any other error propagates.
     */
    async getBalance(): Promise<AccountBalance | null> {
        try {
            const data = await apiClient.get<BalanceResponse>(`${API_BASE}/billing/balance`, {
                suppressUnauthorizedRedirect: true,
            })
            const raw = data?.data ?? data
            return {
                amount: Number(raw?.balance ?? raw?.amount ?? 0),
                currency: String(raw?.currency ?? "USD"),
            }
        } catch (error) {
            if (isNotImplemented(error)) return null
            throw error
        }
    }

    /**
     * Recharge packages + the minimum custom amount. Returns `null` when the
     * endpoint isn't live yet so the page can fall back gracefully.
     */
    async getPackages(): Promise<PackagesInfo | null> {
        try {
            const data = await apiClient.get<{ packages?: BillingPackage[]; minimumCustom?: number; currency?: string; data?: any }>(
                `${API_BASE}/billing/packages`,
            )
            const raw = data?.data ?? data
            return {
                packages: Array.isArray(raw?.packages) ? raw.packages : [],
                minimumCustom: Number(raw?.minimumCustom ?? 10),
                currency: String(raw?.currency ?? "USD"),
            }
        } catch (error) {
            if (isNotImplemented(error)) return null
            throw error
        }
    }

    /**
     * Create a Stripe Checkout session for `amount` USD. Returns the hosted URL
     * the caller redirects to (`window.location.href = checkoutUrl`).
     *
     * Throws:
     *  • `BillingNotConfiguredError` while the route is missing (404/501)
     *  • the raw `ApiError` on 422 (validation) / 500 (Stripe) so the caller can
     *    branch on `error.status` and surface the right message.
     */
    async createCheckout(amount: number): Promise<CheckoutResult> {
        try {
            const res = await apiClient.post<CheckoutResponse>(`${API_BASE}/billing/checkout`, {
                amount,
            })
            const raw = res?.data ?? res
            if (!raw?.checkoutUrl) throw new BillingNotConfiguredError()
            return { checkoutUrl: raw.checkoutUrl, sessionId: String(raw.sessionId ?? "") }
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) throw error
            if (isNotImplemented(error)) throw new BillingNotConfiguredError()
            throw error
        }
    }

    /**
     * Backward-compatible wrapper for the dashboard's quick-recharge dialog, which
     * only needs a payment URL. New surfaces should use `createCheckout` directly.
     */
    async createRecharge(amount: number): Promise<{ paymentUrl: string }> {
        const { checkoutUrl } = await this.createCheckout(amount)
        return { paymentUrl: checkoutUrl }
    }

    /**
     * A page of credit transactions (newest first). Normalizes Laravel's paginated
     * envelope (`{ data, meta, links }`) into a flat `TransactionsPage`.
     */
    async getTransactions(page = 1): Promise<TransactionsPage> {
        const res = await apiClient.get<any>(`${API_BASE}/billing/transactions?page=${page}`)
        const list: CreditTransaction[] = Array.isArray(res?.data) ? res.data : []
        const meta = res?.meta ?? {}
        return {
            data: list,
            currentPage: Number(meta.current_page ?? page),
            lastPage: Number(meta.last_page ?? 1),
            perPage: Number(meta.per_page ?? list.length),
            total: Number(meta.total ?? list.length),
            from: Number(meta.from ?? 0),
            to: Number(meta.to ?? list.length),
        }
    }
}

export const billingService = new BillingService()
