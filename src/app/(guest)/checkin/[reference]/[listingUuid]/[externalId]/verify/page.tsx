import { VerifyScreen } from "@/features/checkin/components/VerifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { redirect } from "next/navigation"

export default async function CheckinVerifyByExternalPage({
    params,
    searchParams
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
    searchParams: Promise<{guest_uuid?: string; from_didit_callback?: string; didit_error?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    if (!resolvedSearchParams.guest_uuid) {
        redirect(`/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}/identify`)
    }

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`

    const portal = await checkinServerService.getPortalByExternal(
        resolvedParams.reference,
        resolvedParams.listingUuid,
        resolvedParams.externalId,
    )
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return (
        <VerifyScreen
            reservationUuid={portal.reservation.uuid}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
            fromCallback={resolvedSearchParams.from_didit_callback === '1'}
            diditError={resolvedSearchParams.didit_error}
        />
    )
}
