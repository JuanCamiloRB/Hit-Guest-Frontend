"use client"

import { Button } from "@/components/ui/button"
import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, ArrowRight } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useTranslation } from "@/hooks/useTranslation"
import { useBalanceStore } from "@/features/billing/hooks/useBalanceStore"
import { Heading } from "@/components/ui/heading"

const BILLING_HREF = "/dashboard/settings?tab=billing"
const AUTO_REDIRECT_MS = 4000

/**
 * Post-Stripe confirmation. Stripe redirects here with `?session_id=cs_...`.
 *
 * The credit is applied by an ASYNC Stripe webhook, so the balance may not reflect
 * it yet (Option A from the plan): we show a "received, updating shortly" message,
 * kick off a balance refresh, and bounce to the billing page where it re-loads.
 */
function BillingSuccessContent() {
    const router = useRouter()
    const params = useSearchParams()
    const sessionId = params.get("session_id")
    const { t } = useTranslation()
    const refresh = useBalanceStore((s) => s.refresh)

    useEffect(() => {
        // Refresh in the background so the header widget catches up once the webhook lands.
        refresh()
        const t = setTimeout(() => router.push(BILLING_HREF), AUTO_REDIRECT_MS)
        return () => clearTimeout(t)
    }, [refresh, router])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-success/20 bg-success-sunk">
                <Icon icon={CheckCircle2} size="3xl" className="text-success" />
            </div>
            <div className="space-y-2">
                <Heading level={1}>{t("billing.success.title")}</Heading>
                <p className="max-w-sm text-sm text-ink-3">{t("billing.success.body")}</p>
                {sessionId && (
                    <p className="text-xs text-ink-4">Ref: {sessionId}</p>
                )}
            </div>
            <Button asChild size="lg">
                <Link
                    href={BILLING_HREF}
                >
                    {t("billing.success.goToBilling")} <Icon icon={ArrowRight} />
                </Link>
            </Button>
        </div>
    )
}

export default function BillingSuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-[60vh]" />}>
            <BillingSuccessContent />
        </Suspense>
    )
}
