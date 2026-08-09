import { SuccessScreen } from "@/features/checkin/components/SuccessScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

export default async function CheckinSuccessByUuidPage({ params }: { params: Promise<{reference: string}> }) {
    const resolvedParams = await params;

    // El try envuelve SOLO la búsqueda de datos, no el render: construir JSX
    // dentro de un try/catch en un Server Component hace que el catch se trague
    // errores del propio render (y de redirect(), que funciona lanzando).
    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortal(resolvedParams.reference)
    } catch {
        portal = null
    }

    if (!portal) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }

    // Cancelada (29) o eliminada (108): el backend responde 200 con solo status +
    // message, SIN `reservation`/`progress`/`registeredGuests`. Sin esta guarda
    // SuccessScreen revienta al leerlos — pasa si el PM cancela después de que el
    // huésped completó y este recarga la pantalla.
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <SuccessScreen portal={portal} reservationUuid={resolvedParams.reference} />
}
