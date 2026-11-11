"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { StatusPill, type StatusTone } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReservationSource } from "../../services/reservation-source-service"
import { ReservationSourceIdentity, reservationSourceName, reservationSourceSlug } from "./ReservationSourceIdentity"
import { Surface } from "@/components/ui/card"

export type ContractChannelStatus = "configured" | "unconfigured" | "dirty" | "incomplete"

const STATUS_COPY: Record<ContractChannelStatus, { label: string; tone: StatusTone }> = {
    configured: { label: "Configurado", tone: "success" },
    unconfigured: { label: "Sin contrato", tone: "idle" },
    dirty: { label: "Cambios sin guardar", tone: "warning" },
    incomplete: { label: "Incompleto", tone: "danger" },
}

interface Props {
    source?: ReservationSource | null
    fallbackName?: string
    status: ContractChannelStatus
    summary: string
    expanded: boolean
    onToggle: () => void
    onRemove?: () => void
    children?: ReactNode
}

export function ContractChannelCard({
    source,
    fallbackName,
    status,
    summary,
    expanded,
    onToggle,
    onRemove,
    children,
}: Props) {
    const statusCopy = STATUS_COPY[status]
    const sourceName = source ? reservationSourceName(source) : fallbackName || "Canal"

    return (
        <Surface as="article" flat className={cn("overflow-hidden transition-colors", status === "dirty" ? "border-warning/40" : status === "incomplete" ? "border-danger/30" : undefined)}>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <ReservationSourceIdentity name={sourceName} slug={source ? reservationSourceSlug(source) : null} />
                        <StatusPill tone={statusCopy.tone}>{statusCopy.label}</StatusPill>
                    </div>
                    <p className={cn("pl-0 text-sm sm:pl-15", status === "unconfigured" ? "text-ink-3" : "font-medium text-ink-2")}>
                        {summary}
                    </p>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                    {onRemove && status !== "unconfigured" && (
                        <Button type="button" variant="ghost-destructive" size="sm" onClick={onRemove}>
                            Quitar configuración
                        </Button>
                    )}
                    <Button type="button" variant={expanded ? "secondary" : "outline"} size="sm" onClick={onToggle} aria-expanded={expanded}>
                        {status === "unconfigured" ? "Configurar" : expanded ? "Cerrar" : "Editar"}
                        {expanded ? <Icon icon={ChevronUp} className="ml-1.5" /> : <Icon icon={ChevronDown} className="ml-1.5" />}
                    </Button>
                </div>
            </div>
            {expanded && children && (
                <div className="border-t border-rule bg-sunk/40 p-4 sm:p-5" aria-label={`Configuración de ${sourceName}`}>
                    {children}
                </div>
            )}
        </Surface>
    )
}

