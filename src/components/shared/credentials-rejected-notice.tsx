import { FeedbackBanner } from "@/components/ui/feedback-banner"
import {
    credentialsRejectionReason,
    formatRejectionSince,
    type CredentialsStatus,
} from "@/lib/credentials-rejection"

interface Props {
    status: CredentialsStatus
    /** Lo que resuelve la pausa: abrir el formulario de credenciales. */
    action?: React.ReactNode
    density?: "default" | "compact"
    className?: string
}

/**
 * El aviso de una configuración en pausa porque el proveedor rechazó sus
 * credenciales (nota backend 2026-11-11). Lo usan la tarjeta de la
 * automatización, la fila del alojamiento y la tarjeta de KunasPMS; las tres
 * ofrecen el mismo arreglo: volver a guardar las credenciales.
 */
export function CredentialsRejectedNotice({ status, action, density = "compact", className }: Props) {
    const since = formatRejectionSince(status.since)
    return (
        <FeedbackBanner
            tone="danger"
            density={density}
            className={className}
            data-credentials-rejected=""
            title={since ? `Credenciales rechazadas desde el ${since}` : "Credenciales rechazadas"}
            action={action}
        >
            <p>{credentialsRejectionReason(status.reason)}</p>
            {status.providerMessage && <p>Mensaje del proveedor: {status.providerMessage}</p>}
            <p>
                Las reservas quedan en espera, sin cobro. Se reanudan solas al guardar las credenciales.
            </p>
        </FeedbackBanner>
    )
}
