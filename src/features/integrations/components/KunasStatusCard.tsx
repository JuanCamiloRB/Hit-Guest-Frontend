"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, Pause, Play, Pencil, Unplug, Mail, Building2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { notifyError } from "@/lib/notify-error"
import { isActive as computeIsActive, type Integration, type KunasConfigurationPayload } from "../types"
import { KunasCredentialsDialog } from "./KunasCredentialsDialog"
import { KunasDisconnectDialog } from "./KunasDisconnectDialog"
import { StatusPill } from "@/components/ui/status-pill"
import { Heading } from "@/components/ui/heading"

interface Props {
    integration: Integration
    /** True right after connecting — lets us show "Sincronizando…" for an empty list. */
    justConnected: boolean
    onSetActive: (active: boolean) => Promise<void>
    onUpdateCredentials: (payload: KunasConfigurationPayload) => Promise<void>
    onDisconnect: () => Promise<void>
}

/** Connected panel — renders both the active (8) and inactive (10) states. */
export function KunasStatusCard({
    integration,
    justConnected,
    onSetActive,
    onUpdateCredentials,
    onDisconnect,
}: Props) {
    const [isToggling, setIsToggling] = useState(false)
    const active = computeIsActive(integration)
    const email = integration.parameters.email ?? "—"
    const properties = integration.parameters.pmsProperties ?? []
    const isSyncing = properties.length === 0 && justConnected

    async function handleToggle() {
        setIsToggling(true)
        try {
            await onSetActive(!active)
            toast.success(active ? "Integración pausada" : "Integración activada")
        } catch (error) {
            notifyError(error, "No se pudo cambiar el estado de la integración")
        } finally {
            setIsToggling(false)
        }
    }

    return (
        <div className="max-w-lg rounded-xl border border-rule bg-white shadow-sm">
            {/* Header: title + status badge */}
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
                <Heading level={3}>Kunas PMS</Heading>
                <StatusPill tone={active ? "success" : "warning"}>{active ? "Activa" : "Inactiva"}</StatusPill>
            </div>

            {/* Body: account + sync info */}
            <div className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-2 text-sm text-ink-2">
                    <Icon icon={Mail} className="text-ink-3" />
                    <span className="font-medium text-ink">{email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-ink-2">
                    <Icon icon={Building2} className="text-ink-3" />
                    {isSyncing ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-ink-3">
                            <Icon icon={Loader2} size="sm" className="animate-spin" />
                            Sincronizando…
                        </span>
                    ) : (
                        <span>
                            Propiedades sincronizadas:{" "}
                            <span className="font-bold text-ink">{properties.length}</span>
                        </span>
                    )}
                </div>
                {!active && (
                    <p className="text-sm text-warning">
                        Integración pausada — los webhooks de KunasPMS se rechazan mientras esté inactiva.
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-rule px-5 py-4">
                <KunasCredentialsDialog
                    currentEmail={integration.parameters.email ?? ""}
                    onSave={onUpdateCredentials}
                    trigger={
                        <Button variant="outline" size="sm">
                            <Icon icon={Pencil} /> Editar credenciales
                        </Button>
                    }
                />

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={isToggling}
                >
                    {isToggling ? (
                        <Icon icon={Loader2} className="animate-spin" />
                    ) : active ? (
                        <Icon icon={Pause} />
                    ) : (
                        <Icon icon={Play} />
                    )}
                    {active ? "Pausar" : "Activar"}
                </Button>

                <KunasDisconnectDialog
                    onConfirm={onDisconnect}
                    trigger={
                        <Button
                            variant="ghost-destructive"
                            size="sm"
                        >
                            <Icon icon={Unplug} /> Desconectar
                        </Button>
                    }
                />
            </div>
        </div>
    )
}
