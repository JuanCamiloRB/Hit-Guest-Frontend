"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReservationSource } from "../../services/reservation-source-service"
import { ReservationSourceIdentity, reservationSourceName, reservationSourceSlug } from "./ReservationSourceIdentity"

export type ContractChannelStatus = "configured" | "unconfigured" | "dirty" | "incomplete"

const STATUS_COPY: Record<ContractChannelStatus, { label: string; className: string }> = {
    configured: { label: "Configurado", className: "border-success/30 bg-success-sunk text-success" },
    unconfigured: { label: "Sin contrato", className: "border-rule bg-sunk text-ink-2" },
    dirty: { label: "Cambios sin guardar", className: "border-warning/30 bg-warning-sunk text-warning" },
    incomplete: { label: "Incompleto", className: "border-danger/30 bg-danger-sunk text-danger" },
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
        <article className={cn(
            "overflow-hidden rounded-xl border bg-white transition-colors",
            status === "dirty" ? "border-warning/40" : status === "incomplete" ? "border-danger/30" : "border-rule",
        )}>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <ReservationSourceIdentity name={sourceName} slug={source ? reservationSourceSlug(source) : null} />
                        <Badge variant="outline" className={cn("h-6 rounded-full px-2.5 text-xs font-bold", statusCopy.className)}>
                            {statusCopy.label}
                        </Badge>
                    </div>
                    <p className={cn("pl-0 text-sm sm:pl-15", status === "unconfigured" ? "text-ink-3" : "font-medium text-ink-2")}>
                        {summary}
                    </p>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                    {onRemove && status !== "unconfigured" && (
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-ink-3 hover:text-danger">
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
        </article>
    )
}

