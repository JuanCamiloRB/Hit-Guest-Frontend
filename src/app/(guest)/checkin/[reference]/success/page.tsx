import { SuccessScreen } from "@/features/checkin/components/SuccessScreen"
import { checkinService } from "@/features/checkin/services/checkin-service"

export default async function CheckinSuccessByUuidPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;

    try {
        const portal = await checkinService.getPortal(resolvedParams.reference)
        return <SuccessScreen portal={portal} reservationUuid={resolvedParams.reference} />
    } catch (error) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }
}
