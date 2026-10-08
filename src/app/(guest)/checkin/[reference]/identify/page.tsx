import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { resolveIdentifyResume } from "@/features/checkin/lib/identify-resume"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
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

    // Una sola llamada al portal: antes se pedía dos veces, una por rama.
    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortal(resolvedParams.reference)
    } catch {
        // Sin portal no se puede enrutar ni validar la reserva; se resuelve abajo.
    }

    // Cancelada (29) o eliminada (108): 200 con solo status + message, sin
    // `reservation`/`registeredGuests`.
    if (portal?.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    // El huésped ya pasó por identify: se lo manda al paso que dice el backend.
    //
    // `redirect()` va FUERA de cualquier try/catch a propósito: funciona LANZANDO
    // un error NEXT_REDIRECT, y un `catch {}` vacío se lo tragaba — el huésped
    // caía siempre al formulario de identificación.
    const resumeTarget = resolveIdentifyResume(portal, resolvedSearch.guest_uuid, basePath)
    if (resumeTarget) redirect(resumeTarget)

    // Sin portal no se puede confirmar que la reserva exista, con o sin
    // guest_uuid. Mostrar el formulario acá dejaría al huésped llenando datos que
    // el envío va a rechazar igual.
    if (!portal) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }

    return (
        <IdentifyScreen
            reservationUuid={resolvedParams.reference}
            basePath={basePath}
            initialGuestCountRequired={portal.reservation?.requiresGuestCountDeclaration === true}
            initialPriceDeclaration={{
                required: portal.reservation?.requiresPriceDeclaration === true,
                currency: portal.reservation?.currency ?? null,
            }}
        />
    )
}
