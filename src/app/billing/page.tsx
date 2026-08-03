import { redirect } from "next/navigation"

/**
 * Stripe cancel_url is `{FRONTEND_URL}/billing` (no /dashboard prefix). Forward the
 * PM back to the real billing UI so a cancelled checkout lands somewhere useful.
 */
export default function BillingCancelRedirect() {
    redirect("/dashboard/settings?tab=billing")
}
