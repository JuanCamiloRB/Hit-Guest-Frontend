import { DiditCallbackClient } from "@/features/checkin/components/DiditCallbackClient"

/**
 * Didit Callback Page
 *
 * URL to configure in Didit workflow settings → "Callback URL":
 *   https://hit-guest-frontend.vercel.app/checkin/didit/callback
 *
 * Didit redirects here via GET after the user completes (or fails) verification:
 *   GET /checkin/didit/callback?verificationSessionId=xxx&status=Approved
 *
 * Status values Didit can send:
 *   - "Approved"   → verification successful
 *   - "Declined"   → user failed verification
 *   - "Expired"    → session expired
 *   - "Abandoned"  → user closed without completing
 *
 * This is a static route — Next.js resolves it before the dynamic [reference] segment,
 * so /checkin/didit/callback does NOT conflict with /checkin/[reference]/...
 */
export default async function DiditCallbackPage({
    searchParams,
}: {
    searchParams: Promise<{ verificationSessionId?: string; status?: string }>
}) {
    const resolved = await searchParams
    const verificationSessionId = resolved.verificationSessionId ?? ""
    const status = resolved.status ?? ""

    return (
        <DiditCallbackClient
            verificationSessionId={verificationSessionId}
            status={status}
        />
    )
}
