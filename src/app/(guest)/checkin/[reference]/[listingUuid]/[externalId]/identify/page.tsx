import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { resolveIdentifyResume } from "@/features/checkin/lib/identify-resume"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { redirect } from "next/navigation"

export default async function CheckinIdentifyByExternalPage({
    params,
    searchParams,
}: {
    params: Promise<{reference: string; listingUuid: string; externalId: string}>
    searchParams: Promise<{guest_uuid?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;

    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortalByExternal(
            resolvedParams.reference,
            resolvedParams.listingUuid,
            resolvedParams.externalId,
        )
    } catch {
        portal = null
    }

    if (!portal) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }

    const basePath = `/checkin/${resolvedParams.reference}/${resolvedParams.listingUuid}/${resolvedParams.externalId}`
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    // Mismo reanudar que la ruta por UUID: los «Continuar» del hub traen
    // `?guest_uuid=`. Fuera de try/catch: `redirect()` lanza NEXT_REDIRECT.
    const resumeTarget = resolveIdentifyResume(portal, resolvedSearch.guest_uuid, basePath)
    if (resumeTarget) redirect(resumeTarget)

    return (
        <IdentifyScreen
            reservationUuid={portal.reservation.uuid}
            basePath={basePath}
            initialGuestCountRequired={portal.reservation.requiresGuestCountDeclaration === true}
            initialPriceDeclaration={{
                required: portal.reservation.requiresPriceDeclaration === true,
                currency: portal.reservation.currency ?? null,
            }}
        />
    )
}
