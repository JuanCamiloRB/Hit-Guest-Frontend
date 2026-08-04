import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { SecondarySuccessScreen } from "@/features/checkin/components/SecondarySuccessScreen"

export const metadata: Metadata = {
    title: "Check-in Completado | Hit Guest",
}

export default async function SecondarySuccessPage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    try {
        const portal = await checkinServerService.getPortal(resolvedParams.reference)
        return <SecondarySuccessScreen portal={portal} reservationUuid={resolvedParams.reference} />
    } catch (error) {
        return notFound()
    }
}
