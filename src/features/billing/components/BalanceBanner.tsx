"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { formatUsd, getBalanceState } from "../types"
import { UnstyledButton } from "@/components/ui/unstyled-button"

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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-danger/30 bg-danger-sunk px-4 py-3 sm:px-6 md:px-10">
                <div className="flex items-center gap-2.5 text-sm font-medium text-danger">
                    <Icon icon={AlertTriangle} />
                    <span>Your automations are paused. Your account has no credits left.</span>
                </div>
                <Link
                    href={BILLING_HREF}
                    className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-destructive-hover"
                >
                    Add Credits
                </Link>
            </div>
        )
    }

    // Low balance (dismissible).
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning-sunk px-4 py-3 sm:px-6 md:px-10">
            <div className="flex items-center gap-2.5 text-sm font-medium text-warning">
                <Icon icon={AlertTriangle} />
                <span>
                    Your balance is running low ({formatUsd(amount)} remaining). Top up to avoid
                    interruptions.
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Link
                    href={BILLING_HREF}
                    className="rounded-lg bg-warning px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-warning/90"
                >
                    Add Credits
                </Link>
                <UnstyledButton
                    type="button"
                    onClick={dismissLowBanner}
                    aria-label="Descartar"
                    className="rounded-md p-1 text-warning transition-colors hover:bg-warning-sunk hover:text-warning"
                >
                    <Icon icon={X} />
                </UnstyledButton>
            </div>
        </div>
    )
}
