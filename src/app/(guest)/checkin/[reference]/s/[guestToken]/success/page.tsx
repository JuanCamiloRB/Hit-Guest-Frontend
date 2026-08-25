import { Metadata } from "next"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { SecondarySuccessScreen } from "@/features/checkin/components/SecondarySuccessScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

export const metadata: Metadata = {
    title: "Check-in Completado | Hit Guest",
}

export default async function SecondarySuccessPage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    // El try envuelve solo la búsqueda de datos, nunca el render (ver la página
    // hermana /checkin/[reference]/success).
    let portal: CheckinPortalResponse | null = null
    try {
        portal = await checkinServerService.getPortal(resolvedParams.reference)
    } catch {
        portal = null
    }

    if (!portal) {
        // Ver la página hermana /checkin/[reference]/success: un 404 genérico acá
        // sería falso — el POST del acompañante pudo haber hecho commit aunque
        // esta lectura falle, y repetir el proceso no es idempotente.
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

    // Cancelada/eliminada → 200 sin `reservation`, y `SecondarySuccessScreen` la
    // lee en su primera línea.
    if (portal.portalStatus) {
        return <PortalStatusScreen status={portal.portalStatus} message={portal.message} />
    }

    return <SecondarySuccessScreen portal={portal} reservationUuid={resolvedParams.reference} />
}
