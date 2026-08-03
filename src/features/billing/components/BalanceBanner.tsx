"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { formatUsd, getBalanceState } from "../types"

const BILLING_HREF = "/dashboard/settings?tab=billing"

/**
 * Global, non-blocking balance banner shown on every dashboard page:
 *  • balance <= 0  → "automations paused" alert, no dismiss (persists until recharge)
 *  • 0 < balance <= 5 → low-balance warning, dismissible for the session
 *
 * Reads the shared balance store (loaded by the header widget), so it costs no
 * extra fetch and disappears automatically once a recharge lifts the balance.
 */
export function BalanceBanner() {
    const { amount, pending, loaded, lowBannerDismissed, load, dismissLowBanner } = useBalanceStore()

    useEffect(() => {
        load()
    }, [load])

    if (pending || !loaded || amount === null) return null
    const state = getBalanceState(amount)
    if (state === "normal") return null
    if (state === "low" && lowBannerDismissed) return null

    if (state === "depleted") {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3 sm:px-6 md:px-10">
                <div className="flex items-center gap-2.5 text-sm font-medium text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Your automations are paused. Your account has no credits left.</span>
                </div>
                <Link
                    href={BILLING_HREF}
                    className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700"
                >
                    Add Credits
                </Link>
            </div>
        )
    }

    // Low balance (dismissible).
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 md:px-10">
            <div className="flex items-center gap-2.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                    Your balance is running low ({formatUsd(amount)} remaining). Top up to avoid
                    interruptions.
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Link
                    href={BILLING_HREF}
                    className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600"
                >
                    Add Credits
                </Link>
                <button
                    type="button"
                    onClick={dismissLowBanner}
                    aria-label="Descartar"
                    className="rounded-md p-1 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
