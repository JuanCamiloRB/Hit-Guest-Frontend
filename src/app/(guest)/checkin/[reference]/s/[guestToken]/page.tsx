import { Metadata } from "next"
import { notFound } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { SecondaryGateScreen } from "@/features/checkin/components/SecondaryGateScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"

export const metadata: Metadata = {
    title: "Check-in | Huésped Adicional",
}

export default async function SecondaryGatePage({
    params
}: {
    params: Promise<{reference: string; guestToken: string}>
}) {
    const resolvedParams = await params;

    const gate = await checkinServerService.resolveSecondaryGate(
        resolvedParams.reference,
        resolvedParams.guestToken,
    )
    if (gate.kind === "unavailable") notFound()
    // Reserva cancelada/eliminada: se explica, en vez de caer en el notFound()
    // genérico ("no encontrada") que no le dice nada al huésped.
    if (gate.kind === "portal_closed") {
        return <PortalStatusScreen status={gate.portalStatus} message={gate.message} />
    }

    // Esta pantalla NO exige que el titular haya completado: existe justamente
    // para decirle al acompañante que lo está esperando.
    const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`
    return <SecondaryGateScreen status={gate.status} basePath={basePath} />
}
