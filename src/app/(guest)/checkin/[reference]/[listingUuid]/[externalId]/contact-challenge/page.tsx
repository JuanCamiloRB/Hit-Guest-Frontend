import { ContactChallengeScreen } from "@/features/checkin/components/ContactChallengeScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { redirect } from "next/navigation"

export default async function CheckinContactChallengeByExternalPage({
    params,
    searchParams
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
    searchParams: Promise<{guest_uuid?: string}>
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
        <ContactChallengeScreen
            reservationUuid={portal.reservation.uuid}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
        />
    )
}
