import { WelcomeScreen } from "@/features/checkin/components/WelcomeScreen"
import { DiditCallbackClient } from "@/features/checkin/components/DiditCallbackClient"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

export default async function CheckinByUuidPage({
    params,
    searchParams,
}: {
    params: Promise<{ reference: string }>
    searchParams: Promise<{ verificationSessionId?: string; status?: string; guest?: string; guestUuid?: string }>
}) {
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;

    // Defensive: Didit (or the backend) sometimes redirects to
    // /checkin/{reservationUuid}?verificationSessionId=...&status=... instead of
    // the dedicated /checkin/didit/callback route. Handle that pattern here so the
    // guest isn't dropped on the welcome screen mid-verification. The reservation is
    // in the path, so the flow resumes even if localStorage context was lost (mobile).
    if (resolvedSearch.verificationSessionId) {
        return (
            <DiditCallbackClient
                verificationSessionId={resolvedSearch.verificationSessionId}
                status={resolvedSearch.status ?? ""}
                reservationUuid={resolvedParams.reference}
                guestUuid={resolvedSearch.guest ?? resolvedSearch.guestUuid}
            />
        )
    }

    // Solo la petición va en el try. Construir el JSX acá adentro hacía que este
    // catch pudiera tragarse un error lanzado al renderizar —incluidas las
    // señales de control de Next, que funcionan lanzando— y lo reportara como
    // "reserva no encontrada".
    let portal: CheckinPortalResponse
    try {
        portal = await checkinServerService.getPortal(resolvedParams.reference)
    } catch {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Reserva no encontrada</h1>
                <p className="text-slate-500">No pudimos encontrar la reserva o el link ha expirado.</p>
            </div>
        )
    }

    // v4.5: cancelled (29) / deleted (108) reservations return only a status
    // + message, with no reservation data — show a dedicated screen.
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <WelcomeScreen portal={portal} basePath={`/checkin/${resolvedParams.reference}`} />
}
