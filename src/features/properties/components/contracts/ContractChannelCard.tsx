"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReservationSource } from "../../services/reservation-source-service"
import { ReservationSourceIdentity } from "./ReservationSourceIdentity"

export type ContractChannelStatus = "configured" | "unconfigured" | "dirty" | "incomplete"

const STATUS_COPY: Record<ContractChannelStatus, { label: string; className: string }> = {
    configured: { label: "Configurado", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    unconfigured: { label: "Sin contrato", className: "border-slate-200 bg-slate-100 text-slate-600" },
    dirty: { label: "Cambios sin guardar", className: "border-amber-200 bg-amber-50 text-amber-700" },
    incomplete: { label: "Incompleto", className: "border-red-200 bg-red-50 text-red-700" },
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
    const sourceName = source?.name_translations?.es || source?.name || fallbackName || "Canal"

    return (
        <article className={cn(
            "overflow-hidden rounded-2xl border bg-white transition-colors",
            status === "dirty" ? "border-amber-300" : status === "incomplete" ? "border-red-200" : "border-slate-200",
        )}>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <ReservationSourceIdentity source={source} fallbackName={fallbackName} />
                        <Badge variant="outline" className={cn("h-6 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide", statusCopy.className)}>
                            {statusCopy.label}
                        </Badge>
                    </div>
                    <p className={cn("pl-0 text-sm sm:pl-[60px]", status === "unconfigured" ? "text-slate-500" : "font-medium text-slate-700")}>
                        {summary}
                    </p>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                    {onRemove && status !== "unconfigured" && (
                        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-slate-500 hover:text-red-600">
                            Quitar configuración
                        </Button>
                    )}
                    <Button type="button" variant={expanded ? "secondary" : "outline"} size="sm" onClick={onToggle} aria-expanded={expanded}>
                        {status === "unconfigured" ? "Configurar" : expanded ? "Cerrar" : "Editar"}
                        {expanded ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
                    </Button>
                </div>
            </div>
            {expanded && children && (
                <div className="border-t border-slate-200 bg-slate-50/40 p-4 sm:p-5" aria-label={`Configuración de ${sourceName}`}>
                    {children}
                </div>
            )}
        </article>
    )
}

