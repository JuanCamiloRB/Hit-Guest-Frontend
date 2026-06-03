import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { redirect } from "next/navigation"

export default async function CheckinIdentifyPage({ 
    params,
    searchParams 
}: { 
    params: Promise<{reference: string}>
    searchParams: Promise<{guest_uuid?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;
    const basePath = `/checkin/${resolvedParams.reference}`

    // If guest_uuid is provided, the guest is already identified — skip to next step
    if (resolvedSearch.guest_uuid) {
        redirect(`${basePath}/guest?guest_uuid=${resolvedSearch.guest_uuid}`)
    }

    try {
        await checkinService.getPortal(resolvedParams.reference)
        return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
    } catch (error) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }
}
