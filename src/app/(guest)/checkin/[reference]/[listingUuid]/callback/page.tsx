import { DiditCallbackClient } from "@/features/checkin/components/DiditCallbackClient"

/**
 * Didit Callback Page — reservation + guest in the path (backend's chosen shape):
 *   {FRONTEND_URL}/checkin/{reservationUuid}/{guestUuid}/callback
 *
 * Didit appends its own params:
 *   .../checkin/{reservationUuid}/{guestUuid}/callback?verificationSessionId=xxx&status=Approved
 *
 * Routing note: the segments map to the existing dynamic names
 *   [reference]   = reservationUuid
 *   [listingUuid] = guestUuid
 * and the trailing STATIC `callback` segment takes priority over the sibling
 * dynamic [externalId] route, so this doesn't collide with the external check-in
 * flow (/checkin/{sourceSlug}/{listingUuid}/{externalId}).
 *
 * Putting reservation + guest in the path makes the flow survive mobile
 * localStorage loss (WhatsApp/Camera in-app browser → Safari, private mode).
 */
export default async function DiditPathCallbackPage({
    params,
    searchParams,
}: {
    params: Promise<{ reference: string; listingUuid: string }>
    searchParams: Promise<{ verificationSessionId?: string; status?: string }>
}) {
    const { reference: reservationUuid, listingUuid: guestUuid } = await params
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
