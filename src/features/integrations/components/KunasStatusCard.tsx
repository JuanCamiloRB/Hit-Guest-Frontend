"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, Pause, Play, Pencil, Unplug, Mail, Building2 } from "lucide-react"
import { notifyError } from "@/lib/notify-error"
import { isActive as computeIsActive, type Integration, type KunasConfigurationPayload } from "../types"
import { KunasCredentialsDialog } from "./KunasCredentialsDialog"
import { KunasDisconnectDialog } from "./KunasDisconnectDialog"

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
        <div className="max-w-lg rounded-2xl border border-rule bg-white shadow-sm">
            {/* Header: title + status badge */}
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
                <h3 className="text-lg font-bold text-ink">Kunas PMS</h3>
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                        active
                            ? "bg-success-sunk text-success"
                            : "bg-warning-sunk text-warning"
                    }`}
                >
                    <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {active ? "Activa" : "Inactiva"}
                </span>
            </div>

            {/* Body: account + sync info */}
            <div className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-2 text-sm text-ink-2">
                    <Mail className="h-4 w-4 text-ink-3" />
                    <span className="font-medium text-ink">{email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-ink-2">
                    <Building2 className="h-4 w-4 text-ink-3" />
                    {isSyncing ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-ink-3">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Pencil className="h-3.5 w-3.5" /> Editar credenciales
                        </Button>
                    }
                />

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    disabled={isToggling}
                    className="gap-1.5"
                >
                    {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : active ? (
                        <Pause className="h-3.5 w-3.5" />
                    ) : (
                        <Play className="h-3.5 w-3.5" />
                    )}
                    {active ? "Pausar" : "Activar"}
                </Button>

                <KunasDisconnectDialog
                    onConfirm={onDisconnect}
                    trigger={
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            <Unplug className="h-3.5 w-3.5" /> Desconectar
                        </Button>
                    }
                />
            </div>
        </div>
    )
}
