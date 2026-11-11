"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Wallet, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { formatUsd, getBalanceState } from "../types"

const BILLING_HREF = "/dashboard/settings?tab=billing"

/**
 * Persistent balance chip in the header. Loads the balance once on mount and
 * links to the billing page. Hidden while the backend endpoint is pending so we
 * never show a misleading $0.
 */
export function BalanceWidget() {
    const { amount, isLoading, loaded, pending, load } = useBalanceStore()

    useEffect(() => {
        load()
    }, [load])

    // Nothing to show until the first load resolves, or if billing isn't live yet.
    if (pending) return null
    if (!loaded && isLoading) {
        return <div className="hidden sm:block h-10 w-24 rounded-lg bg-sunk animate-pulse" />
    }
    if (amount === null) return null

    const state = getBalanceState(amount)
    const styles =
        state === "depleted"
            ? "bg-danger-sunk border-danger/30 text-danger hover:bg-danger-sunk"
            : state === "low"
              ? "bg-warning-sunk border-warning/30 text-warning hover:bg-warning-sunk"
              : "bg-sunk/50 border-rule text-ink-2 hover:bg-sunk"

    return (
        <Link
            href={BILLING_HREF}
            className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors",
                styles,
            )}
            aria-label="Ver saldo y recargar"
        >
            {state === "normal" ? (
                <Wallet className="h-4 w-4 shrink-0" />
            ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span className="tabular-nums">{formatUsd(amount)}</span>
            <span className="hidden md:inline text-xs font-semibold text-ink-3">USD</span>
        </Link>
    )
}
