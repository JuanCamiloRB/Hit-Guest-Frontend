import { SuccessScreen } from "@/features/checkin/components/SuccessScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"

export default async function CheckinSuccessByUuidPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;

    try {
        const portal = await checkinServerService.getPortal(resolvedParams.reference)
        return <SuccessScreen portal={portal} reservationUuid={resolvedParams.reference} />
    } catch (error) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }
}
