import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"

export const metadata: Metadata = {
    title: "Identidad | Hit Guest",
}

export default async function SecondaryIdentifyPage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    try {
        const status = await checkinServerService.getSecondaryGateStatus(resolvedParams.reference, resolvedParams.guestToken)
        if (!status.mainGuestCompleted) return notFound()
            
        const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`
        return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} isMainGuest={false} isSecondary={true} />
    } catch (error) {
        return notFound()
    }
}
