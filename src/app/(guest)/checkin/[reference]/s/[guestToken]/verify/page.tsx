import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
import { VerifyScreen } from "@/features/checkin/components/VerifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"

export const metadata: Metadata = {
    title: "Verificación | Hit Guest",
}

export default async function SecondaryVerifyPage({
    params,
    searchParams
}: {
    params: Promise<{reference: string; guestToken: string}>
    searchParams: Promise<{guest_uuid?: string; from_didit_callback?: string; didit_error?: string}>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const basePath = `/checkin/${resolvedParams.reference}/s/${resolvedParams.guestToken}`

    // Antes del fetch: sin guest no hay nada que verificar, y pedir el portal
    // para después descartarlo era una petición al backend por nada.
    if (!resolvedSearchParams.guest_uuid) redirect(`${basePath}/identify`)

    const gate = await checkinServerService.resolveSecondaryGate(
        resolvedParams.reference,
        resolvedParams.guestToken,
    )
    if (gate.kind === "unavailable") notFound()
    if (gate.kind === "portal_closed") {
        return <PortalStatusScreen status={gate.portalStatus} message={gate.message} />
    }
    if (!gate.status.mainGuestCompleted) notFound()

    return (
        <VerifyScreen
            reservationUuid={resolvedParams.reference}
            guestUuid={resolvedSearchParams.guest_uuid}
            basePath={basePath}
            isSecondary={true}
            formStorageKey={`checkin-secondary-form-${resolvedParams.guestToken}`}
            // A secondary guest returns from Didit to THIS basePath
            // (/checkin/{ref}/s/{token}/verify?...&from_didit_callback=1).
            // Dropping the flag here left them on a static screen: the portal
            // polling that resolves the verification never started.
            fromCallback={resolvedSearchParams.from_didit_callback === '1'}
            diditError={resolvedSearchParams.didit_error}
        />
    )
}
