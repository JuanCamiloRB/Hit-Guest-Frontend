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

    // If guest_uuid is provided, the guest already went through identify.
    // Check their current verification step to route them to the right screen.
    if (resolvedSearch.guest_uuid) {
        try {
            const portal = await checkinService.getPortal(resolvedParams.reference)
            const guest = portal.registeredGuests.find(g => g.uuid === resolvedSearch.guest_uuid)
            const currentStep = guest?.verification?.currentStep

            if (currentStep === "verification") {
                // Guest needs to complete (or retry) identity verification
                redirect(`${basePath}/verify?guest_uuid=${resolvedSearch.guest_uuid}`)
            }
            // "form", "completed", or no step — go to the data form
            redirect(`${basePath}/guest?guest_uuid=${resolvedSearch.guest_uuid}`)
        } catch {
            // If portal fetch fails, fall through to IdentifyScreen
        }
    }

    try {
        await checkinService.getPortal(resolvedParams.reference)
        return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
    } catch (error) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }
}
