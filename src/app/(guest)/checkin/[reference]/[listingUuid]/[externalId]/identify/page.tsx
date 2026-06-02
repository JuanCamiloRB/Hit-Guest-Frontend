import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { checkinService } from "@/features/checkin/services/checkin-service"

export default async function CheckinIdentifyByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    try {
        await checkinService.getPortal(resolvedParams.reference)
        const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`

        return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
    } catch (error) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }
}
