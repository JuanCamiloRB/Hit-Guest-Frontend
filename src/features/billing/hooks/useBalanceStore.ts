"use client"

import { create } from "zustand"
import { billingService } from "../services/billing-service"
import { getBalanceState, type BalanceState } from "../types"

/**
 * Single source of truth for the account balance, shared by the header widget,
 * the global banner and the billing page so they never disagree or double-fetch.
 *
 * We deliberately do NOT poll: `load()` fetches once (idempotent), and `refresh()`
 * forces a refetch on the moments that matter — login, returning from Stripe, and
 * navigating to the billing page.
 */
interface BalanceStore {
    amount: number | null
    currency: string
    /** True while the endpoint is unavailable (backend pending → 404). */
    pending: boolean
    isLoading: boolean
    loaded: boolean
    /** Whether the PM dismissed the low-balance banner this session. */
    lowBannerDismissed: boolean

    /** Fetch once. No-op if already loaded or in flight. */
    load: () => Promise<void>
    /** Force a refetch (after recharge / on billing page). */
    refresh: () => Promise<void>
    dismissLowBanner: () => void
    state: () => BalanceState
}

async function fetchInto(
    set: (partial: Partial<BalanceStore>) => void,
): Promise<void> {
    set({ isLoading: true })
    try {
        const balance = await billingService.getBalance()
        if (balance === null) {
            set({ pending: true, amount: null, isLoading: false, loaded: true })
            return
        }
        set({
            amount: balance.amount,
            currency: balance.currency,
            pending: false,
            isLoading: false,
            loaded: true,
        })
    } catch {
        // Keep any previous value; mark not-pending so we don't hide the UI.
        set({ isLoading: false, loaded: true })
    }
}

export const useBalanceStore = create<BalanceStore>((set, get) => ({
    amount: null,
    currency: "USD",
    pending: false,
    isLoading: false,
    loaded: false,
    lowBannerDismissed: false,

    load: async () => {
        const { loaded, isLoading } = get()
        if (loaded || isLoading) return
        await fetchInto(set)
    },
    refresh: async () => {
        await fetchInto(set)
    },
    dismissLowBanner: () => set({ lowBannerDismissed: true }),
    state: () => getBalanceState(get().amount),
}))
