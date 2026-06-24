import { redirect } from "next/navigation"
import { DiditCallbackClient } from "@/features/checkin/components/DiditCallbackClient"

/**
 * Bare /checkin route — safety net for the Didit callback.
 *
 * The backend/Didit sometimes redirects to /checkin?verificationSessionId=...&status=...
 * (the FRONTEND domain but WITHOUT the reservation reference in the path), which would
 * otherwise 404. DiditCallbackClient doesn't need the reference — it recovers the full
 * context (reservationUuid, guestUuid, basePath) from localStorage — so we can resume
 * the flow here just like the dedicated /checkin/didit/callback route.
 *
 * Without a verificationSessionId there's nothing meaningful at /checkin, so send the
 * user home.
 */
export default async function CheckinCallbackFallbackPage({
    searchParams,
}: {
    searchParams: Promise<{ verificationSessionId?: string; status?: string }>
}) {
    const resolved = await searchParams

    if (resolved.verificationSessionId) {
        return (
            <DiditCallbackClient
                verificationSessionId={resolved.verificationSessionId}
                status={resolved.status ?? ""}
            />
        )
    }

    redirect("/")
}
