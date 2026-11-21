"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Wallet, AlertTriangle } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { formatUsdNumber, getBalanceState } from "../types"
import { Figure } from "@/components/ui/figure"
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
    // Con saldo, el morado claro de lo destacado; bajo o agotado, el color del estado.
    const variant =
        state === "depleted" ? "outline-destructive" : state === "low" ? "outline-warning" : "accent"
    const tone = state === "depleted" ? "danger" : state === "low" ? "warning" : "ink"

    return (
        <Button asChild variant={variant}>
            <Link href={BILLING_HREF} aria-label="Ver saldo y recargar" data-balance-state={state}>
                {state === "normal" ? (
                    <Icon icon={Wallet} className="text-primary-hover" />
                ) : (
                    <Icon icon={AlertTriangle} />
                )}
                {/* La cifra en Gabarito, como el saldo del Tablero; «USD» una sola vez. */}
                <Figure size="md" tone={tone}>{formatUsdNumber(amount)}</Figure>
                <span className={state === "normal" ? "text-xs font-semibold text-ink-2" : "text-xs font-semibold"}>USD</span>
            </Link>
        </Button>
    )
}
