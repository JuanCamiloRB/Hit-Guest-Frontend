"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Wallet, AlertTriangle } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { formatUsd, getBalanceState } from "../types"
import { Skeleton } from "@/components/ui/skeleton"

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
        return <Skeleton className="hidden sm:block h-10 w-24" />
    }
    if (amount === null) return null

    const state = getBalanceState(amount)
    const variant =
        state === "depleted" ? "outline-destructive" : state === "low" ? "outline-warning" : "outline"

    return (
        <Button asChild variant={variant}>
            <Link href={BILLING_HREF} aria-label="Ver saldo y recargar">
                {state === "normal" ? (
                    <Icon icon={Wallet} />
                ) : (
                    <Icon icon={AlertTriangle} />
                )}
                <span className="tabular-nums">{formatUsd(amount)}</span>
                <span className="hidden md:inline text-xs font-semibold text-ink-3">USD</span>
            </Link>
        </Button>
    )
}
