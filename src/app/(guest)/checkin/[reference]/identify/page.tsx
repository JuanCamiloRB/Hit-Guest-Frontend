import { IdentifyScreen } from "@/features/checkin/components/IdentifyScreen"
import { PortalStatusScreen } from "@/features/checkin/components/PortalStatusScreen"
import { checkinServerService } from "@/features/checkin/services/checkin-server-service"
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
    // Estos `redirect()` van FUERA de cualquier try/catch a propósito. `redirect()`
    // funciona LANZANDO un error NEXT_REDIRECT, así que estaban dentro de un try
    // con `catch {}` vacío que se lo tragaba: ninguno de los tres se ejecutaba
    // nunca y el huésped caía siempre al formulario de identificación. Las
    // pantallas del acompañante ya lo resolvían re-lanzando el NEXT_REDIRECT; acá
    // se saca del try, que es la forma que recomienda Next y no depende de
    // reconocer el `digest`.
    if (portal && resolvedSearch.guest_uuid) {
        const guest = portal.registeredGuests.find(g => g.uuid === resolvedSearch.guest_uuid)
        const currentStep = guest?.verification?.currentStep

        if (currentStep === "verification") {
            redirect(`${basePath}/verify?guest_uuid=${resolvedSearch.guest_uuid}`)
        }
        if (currentStep === "contact_challenge") {
            // Huésped recurrente: /identify ya mandó el OTP y sigue sin verificar
            // (plan OTP 20260731). NO puede caer al formulario — /form exige el
            // X-Checkin-Verification-Token que todavía no tiene.
            redirect(`${basePath}/contact-challenge?guest_uuid=${resolvedSearch.guest_uuid}`)
        }
        // "form", "completed", o sin paso → al formulario de datos.
        redirect(`${basePath}/guest?guest_uuid=${resolvedSearch.guest_uuid}`)
    }

    // Sin portal no se puede confirmar que la reserva exista, con o sin
    // guest_uuid. Mostrar el formulario acá dejaría al huésped llenando datos que
    // el envío va a rechazar igual.
    if (!portal) {
        return <div className="text-center p-8">Reserva no encontrada</div>
    }

    return <IdentifyScreen reservationUuid={resolvedParams.reference} basePath={basePath} />
}
