import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { SecondaryGuestFormScreen } from "@/features/checkin/components/SecondaryGuestFormScreen"

export const metadata: Metadata = {
    title: "Datos del Huésped | Hit Guest",
}

export default async function SecondaryGuestPage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    try {
        const status = await checkinService.getSecondaryGateStatus(resolvedParams.reference, resolvedParams.guestToken)
        if (!status.mainGuestCompleted) return notFound()

        const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`
        return <SecondaryGuestFormScreen reservationUuid={resolvedParams.reference} guestToken={resolvedParams.guestToken} basePath={basePath} />
    } catch (error) {
        return notFound()
    }
}
