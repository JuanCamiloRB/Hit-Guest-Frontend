import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { SecondarySuccessScreen } from "@/features/checkin/components/SecondarySuccessScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

export const metadata: Metadata = {
    title: "Check-in Completado | Hit Guest",
}

export default async function SecondarySuccessPage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    // El try envuelve solo la búsqueda de datos, nunca el render (ver la página
    // hermana /checkin/[reference]/success).
    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortal(resolvedParams.reference)
    } catch {
        portal = null
    }

    if (!portal) {
        return notFound()
    }

    // Cancelada/eliminada → 200 sin `reservation`, y `SecondarySuccessScreen` la
    // lee en su primera línea.
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <SecondarySuccessScreen portal={portal} reservationUuid={resolvedParams.reference} />
}
