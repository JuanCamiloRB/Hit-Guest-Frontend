import { Button } from "@/components/ui/button"
import { WelcomeScreen } from "@/features/checkin/components/WelcomeScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { Heading } from "@/components/ui/heading"

export default async function CheckinByExternalPage({
    params,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
}) {
    const resolvedParams = await params;

    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortalByExternal(
            resolvedParams.reference,
            resolvedParams.listingUuid,
            resolvedParams.externalId,
        )
    } catch (error) {
        portal = null
        // Rate limit de la ruta externa (60/min): merece su propia pantalla.
        if ((error as { status?: number })?.status === 429) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                    <Heading level={1} className="mb-2">Demasiados intentos</Heading>
                    <p className="text-ink-3">Espera un momento y vuelve a intentarlo.</p>
                    <Button asChild size="xl">
                        <a
                            href=""
                            className="mt-6"
                        >
                            Reintentar
                        </a>
                    </Button>
                </div>
            )
        }
    }

    if (!portal) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <Heading level={1} className="mb-2">Reserva no encontrada</Heading>
                <p className="text-ink-3">No pudimos encontrar la reserva o el link ha expirado.</p>
            </div>
        )
    }

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <WelcomeScreen portal={portal} basePath={basePath} />
}
