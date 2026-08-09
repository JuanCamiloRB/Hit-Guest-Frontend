import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

export default async function CheckinIdentifyByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortalByExternal(
            resolvedParams.reference,
            resolvedParams.listingUuid,
            resolvedParams.externalId,
        )
    } catch {
        portal = null
    }

    if (!portal) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <IdentifyScreen reservationUuid={portal.reservation.uuid} basePath={basePath} />
}
