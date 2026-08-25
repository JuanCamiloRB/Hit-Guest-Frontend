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
        // El huésped llega acá SEGUNDOS después de un envío que pudo haber sido
        // exitoso (el POST ya hizo commit aunque esta lectura falle). "Reserva no
        // encontrada" sería falso y lo induciría a repetir un proceso no
        // idempotente — se le dice la verdad: no se pudo CARGAR, y reintentar es
        // gratis. Mismo bloque en las tres rutas hermanas de /success.
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">No pudimos cargar el estado de tu check-in</h1>
                <p className="text-slate-500 max-w-sm">
                    Si ya habías enviado tu registro, quedó guardado — no repitas el proceso.
                    Intenta cargar de nuevo en un momento.
                </p>
                {/* href="" recarga esta misma URL, query incluida. */}
                <a href="" className="h-12 px-6 flex items-center justify-center rounded-xl bg-brand-purple font-bold text-white">
                    Reintentar
                </a>
            </div>
        )
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
