import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { ContactChallengeScreen } from "@/features/checkin/components/ContactChallengeScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"

export const metadata: Metadata = {
    title: "Verificación | Hit Guest",
}

export default async function SecondaryContactChallengePage({
    params,
    searchParams
}: {
    params: Promise<{reference: string; guestToken: string}>
    searchParams: Promise<{guest_uuid?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`

    // Antes del fetch: sin guest no hay desafío que resolver.
    if (!resolvedSearchParams.guest_uuid) redirect(`${basePath}/identify`)

    const gate = await checkinServerService.resolveSecondaryGate(
        resolvedParams.reference,
        resolvedParams.guestToken,
    )
    if (gate.kind === "unavailable") notFound()
    if (gate.kind === "portal_closed") {
        return <PortalStatusScreen status={gate.portalStatus} message={gate.message} />
    }
    if (!gate.status.mainGuestCompleted) notFound()

    return (
        <ContactChallengeScreen
            reservationUuid={resolvedParams.reference}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
            isSecondary={true}
        />
    )
}
