import { SuccessScreen } from "@/features/checkin/components/SuccessScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

export default async function CheckinSuccessByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    // El try envuelve solo la búsqueda de datos, nunca el render (ver la página
    // hermana /checkin/[reference]/success).
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

    // Cancelada/eliminada → 200 sin `reservation`; SuccessScreen la lee de una.
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <SuccessScreen portal={portal} reservationUuid={portal.reservation.uuid} />
}
