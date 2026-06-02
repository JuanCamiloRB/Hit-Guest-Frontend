import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { SecondaryGateScreen } from "@/features/checkin/components/SecondaryGateScreen"

export const metadata: Metadata = {
    title: "Check-in | Huésped Adicional",
}

export default async function SecondaryGatePage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    try {
        const status = await checkinService.getSecondaryGateStatus(resolvedParams.reference, resolvedParams.guestToken)
        const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`
        
        return <SecondaryGateScreen status={status} basePath={basePath} />
    } catch (error) {
        return notFound()
    }
}
