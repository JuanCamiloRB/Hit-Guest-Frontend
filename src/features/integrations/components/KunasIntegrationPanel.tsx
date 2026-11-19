"use client"

import { AlertTriangle } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { useKunasIntegration } from "../hooks/useKunasIntegration"
import { KunasConnectForm } from "./KunasConnectForm"
import { KunasStatusCard } from "./KunasStatusCard"
import { LoadingState } from "@/components/ui/loading-state"
import { FeedbackBanner } from "@/components/ui/feedback-banner"

/**
 * Kunas PMS integration screen. Owns the integration state and renders the
 * matching view: connect form (none), or status card (connected active/inactive).
 */
export function KunasIntegrationPanel() {
    const {
        integration,
        isLoading,
        loadError,
        justConnected,
        refetch,
        connect,
        updateCredentials,
        setActive,
        disconnect,
    } = useKunasIntegration()

    if (isLoading) {
        return (
            <LoadingState variant="spinner" />
        )
    }

    // A 404 resolves to `integration: null` (handled below); loadError is only set
    // for real failures (e.g. 500) worth a retry.
    if (loadError) {
        return (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Icon icon={AlertTriangle} size="2xl" className="text-warning" />
                <p className="text-sm text-ink-3">
                    No se pudo cargar el estado de la integración.
                </p>
                <Button variant="outline" size="sm" onClick={refetch}>
                    Reintentar
                </Button>
            </div>
        )
    }

    if (!integration) {
        return (
            <div className="flex flex-col gap-4">
                {/* Conectó pero el backend todavía no expone la integración (la
                    crea en segundo plano): se dice, en vez de volver al formulario
                    como si nada hubiera pasado. */}
                {justConnected && (
                    <FeedbackBanner
                        tone="info"
                        mode="dynamic"
                        title="Recibimos la conexión con KunasPMS"
                        action={<Button type="button" variant="outline" size="sm" onClick={refetch}>Actualizar</Button>}
                    >
                        Puede tardar unos segundos en aparecer. No hace falta volver a conectar.
                    </FeedbackBanner>
                )}
                <KunasConnectForm onConnect={connect} />
            </div>
        )
    }

    return (
        <KunasStatusCard
            integration={integration}
            justConnected={justConnected}
            onSetActive={setActive}
            onUpdateCredentials={updateCredentials}
            onDisconnect={disconnect}
        />
    )
}
