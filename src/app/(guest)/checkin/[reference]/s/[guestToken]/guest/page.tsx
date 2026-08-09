import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { SecondaryGuestFormScreen } from "@/features/checkin/components/SecondaryGuestFormScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"

export const metadata: Metadata = {
    title: "Datos del Huésped | Hit Guest",
}

export default async function SecondaryGuestPage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    const gate = await checkinServerService.resolveSecondaryGate(
        resolvedParams.reference,
        resolvedParams.guestToken,
    )
    if (gate.kind === "unavailable") notFound()
    if (gate.kind === "portal_closed") {
        return <PortalStatusScreen status={gate.portalStatus} message={gate.message} />
    }
    if (!gate.status.mainGuestCompleted) notFound()

    const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`
    return <SecondaryGuestFormScreen reservationUuid={resolvedParams.reference} guestToken={resolvedParams.guestToken} basePath={basePath} />
}
