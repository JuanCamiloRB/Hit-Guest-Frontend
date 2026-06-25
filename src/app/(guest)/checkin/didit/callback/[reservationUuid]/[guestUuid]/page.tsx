import { DiditCallbackClient } from "@/features/checkin/components/DiditCallbackClient"

/**
 * Didit Callback Page (with reservation + guest in the path).
 *
 * URL to build when creating the Didit session (backend):
 *   {FRONTEND_URL}/checkin/didit/callback/{reservationUuid}/{guestUuid}
 *
 * Didit appends its own params:
 *   .../checkin/didit/callback/{reservationUuid}/{guestUuid}?verificationSessionId=xxx&status=Approved
 *
 * Putting the reservation + guest in the PATH makes the flow survive mobile
 * localStorage loss (WhatsApp/Camera in-app browser → Safari, private mode), and
 * the static `didit/callback` prefix avoids colliding with the dynamic
 * /checkin/[reference]/[listingUuid]/[externalId] route.
 *
 * Status values Didit can send: Approved, Declined, Expired, Abandoned.
 */
export default async function DiditCallbackWithIdsPage({
    params,
    searchParams,
}: {
    params: Promise<{ reservationUuid: string; guestUuid: string }>
    searchParams: Promise<{ verificationSessionId?: string; status?: string }>
}) {
    const { reservationUuid, guestUuid } = await params
    const resolved = await searchParams

    return (
        <DiditCallbackClient
            verificationSessionId={resolved.verificationSessionId ?? ""}
            status={resolved.status ?? ""}
            reservationUuid={reservationUuid}
            guestUuid={guestUuid}
        />
    )
}
