"use client"

import { Button } from "@/components/ui/button"
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
                    <span>Tus automatizaciones están en pausa: tu cuenta se quedó sin créditos.</span>
                </div>
                <Button asChild size="sm">
                    <Link
                        href={BILLING_HREF}
                    >
                        Recargar créditos
                    </Link>
                </Button>
            </div>
        )
    }

    // Low balance (dismissible).
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning-sunk px-4 py-3 sm:px-6 md:px-10">
            <div className="flex items-center gap-2.5 text-sm font-medium text-warning">
                <Icon icon={AlertTriangle} />
                <span>
                    Tu saldo se está agotando (quedan {formatUsd(amount)}). Recarga para evitar
                    interrupciones.
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Button asChild size="sm">
                    <Link
                        href={BILLING_HREF}
                    >
                        Recargar créditos
                    </Link>
                </Button>
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
