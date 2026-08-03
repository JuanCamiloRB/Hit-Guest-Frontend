"use client"

import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, ArrowRight } from "lucide-react"
import { useBalanceStore } from "@/features/billing/hooks/useBalanceStore"

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
    const refresh = useBalanceStore((s) => s.refresh)

    useEffect(() => {
        // Refresh in the background so the header widget catches up once the webhook lands.
        refresh()
        const t = setTimeout(() => router.push(BILLING_HREF), AUTO_REDIRECT_MS)
        return () => clearTimeout(t)
    }, [refresh, router])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900">Payment successful!</h1>
                <p className="max-w-sm text-sm text-slate-500">
                    Payment received — your balance will update shortly. Redirecting you to
                    billing…
                </p>
                {sessionId && (
                    <p className="text-[11px] text-slate-300">Ref: {sessionId}</p>
                )}
            </div>
            <Link
                href={BILLING_HREF}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-purple)] px-6 font-bold text-white transition-colors hover:bg-[#8b3ee0]"
            >
                Go to Billing <ArrowRight className="h-4 w-4" />
            </Link>
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
