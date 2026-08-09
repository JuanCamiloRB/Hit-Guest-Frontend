import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"

export const metadata: Metadata = {
    title: "Identidad | Hit Guest",
}

export default async function SecondaryIdentifyPage({
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
    return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} isMainGuest={false} isSecondary={true} />
}
