import { GuestFormScreen } from "@/features/checkin/components/GuestFormScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"

export default async function CheckinGuestByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`

    const portal = await checkinServerService.getPortalByExternal(
        resolvedParams.reference,
        resolvedParams.listingUuid,
        resolvedParams.externalId,
    )
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <GuestFormScreen reservationUuid={portal.reservation.uuid} basePath={basePath} />
}
