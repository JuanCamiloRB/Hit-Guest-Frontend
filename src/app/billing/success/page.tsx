import { redirect } from "next/navigation"

/**
 * Stripe redirects here after a successful top-up (success_url is
 * `{FRONTEND_URL}/billing/success?session_id=...`, without the /dashboard prefix).
 * Forward to the in-dashboard confirmation page, which refreshes the balance and
 * bounces to billing settings — preserving the session_id.
 */
export default async function BillingSuccessRedirect({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string }>
}) {
    const { session_id } = await searchParams
    const qs = session_id ? `?session_id=${encodeURIComponent(session_id)}` : ""
    redirect(`/dashboard/billing/success${qs}`)
}
