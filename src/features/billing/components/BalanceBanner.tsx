"use client"

import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useTranslation } from "@/hooks/useTranslation"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { formatUsd, getBalanceState } from "../types"
import { FeedbackBanner } from "@/components/ui/feedback-banner"

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
    const { t } = useTranslation()
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
            <FeedbackBanner
                tone="danger"
                layout="bar"
                className="border-b border-danger/30"
                title={t("billing.banner.depleted")}
                action={
                    <Button asChild size="sm">
                        <Link href={BILLING_HREF}>{t("billing.addCredits")}</Link>
                    </Button>
                }
            />
        )
    }

    // Low balance (dismissible).
    return (
        <FeedbackBanner
            tone="warning"
            layout="bar"
            className="border-b border-warning/30"
            title={t("billing.banner.low", { amount: formatUsd(amount) })}
            action={
                <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                        <Link href={BILLING_HREF}>{t("billing.addCredits")}</Link>
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={dismissLowBanner} aria-label={t("billing.banner.dismiss")}>
                        <Icon icon={X} />
                    </Button>
                </div>
            }
        />
    )
}
