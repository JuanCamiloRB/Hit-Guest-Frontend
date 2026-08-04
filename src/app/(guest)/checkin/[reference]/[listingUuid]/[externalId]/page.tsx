import { WelcomeScreen } from "@/features/checkin/components/WelcomeScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"

export default async function CheckinByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    try {
        const portal = await checkinServerService.getPortal(resolvedParams.reference)
        const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`

        // v4.5: cancelled (29) / deleted (108) reservations return only a status + message.
        if (portal.portalStatus) {
            return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
        }

        return <WelcomeScreen portal={portal} basePath={basePath} />
    } catch (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Reserva no encontrada</h1>
                <p className="text-slate-500">No pudimos encontrar la reserva o el link ha expirado.</p>
            </div>
        )
    }
}
