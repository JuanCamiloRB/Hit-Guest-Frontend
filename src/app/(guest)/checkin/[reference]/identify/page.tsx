import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { checkinService } from "@/features/checkin/services/checkin-service"

export default async function CheckinIdentifyPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;

    try {
        await checkinService.getPortal(resolvedParams.reference)
        const basePath = `/checkin/${resolvedParams.reference}`

        return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
    } catch (error) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }
}
