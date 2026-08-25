"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, XCircle, Clock, FileText } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/config"
import { automationService } from "@/features/properties/services/automation-service"
import type {
    AutomationUsageRecord,
    UsageRecordStatus,
} from "@/features/properties/types/automation"
import { formatRunDate, errorMessage, TRIGGERED_BY_LABELS } from "./automation-status-meta"

interface AutomationHistoryModalProps {
    reservationUuid: string
    /** Automation to filter records by (null closes the modal). */
    automation: { uuid: string; name: string } | null
    onClose: () => void
}

const RECORD_STATUS_META: Record<UsageRecordStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
    completed: { label: "OK", icon: CheckCircle2, className: "text-emerald-500" },
    failed: { label: "Fallido", icon: XCircle, className: "text-red-500" },
    pending: { label: "Procesando", icon: Clock, className: "text-amber-500" },
}

export function AutomationHistoryModal({ reservationUuid, automation, onClose }: AutomationHistoryModalProps) {
    const [records, setRecords] = useState<AutomationUsageRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isOpen = automation !== null

    useEffect(() => {
        if (!automation) return
        let mounted = true
        setIsLoading(true)
        setError(null)
        automationService
            .listUsageRecords(reservationUuid, automation.uuid)
            .then(all => {
                if (!mounted) return
                // Backend filters by automationUuid; keep a client guard, and cap at
                // the 10 most recent (records arrive newest-first) per the API spec.
                const forAutomation = all.filter(r => r.automationUuid === automation.uuid)
                setRecords(forAutomation.slice(0, 10))
            })
            .catch((e: any) => {
                if (mounted) setError(e?.message || "No se pudo cargar el historial")
            })
            .finally(() => {
                if (mounted) setIsLoading(false)
            })
        return () => { mounted = false }
    }, [automation, reservationUuid])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-w-2xl w-[95vw] sm:w-auto">
                <DialogHeader>
                    <DialogTitle>Historial de ejecuciones</DialogTitle>
                    <DialogDescription>{automation?.name}</DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="text-sm">Cargando historial...</span>
                    </div>
                ) : error ? (
                    <p className="py-8 text-center text-sm text-red-500">{error}</p>
                ) : records.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">
                        Aún no hay ejecuciones registradas para esta automatización.
                    </p>
                ) : (
                    <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                    <th className="py-2 pr-2">#</th>
                                    <th className="py-2 pr-2">Fecha</th>
                                    <th className="py-2 pr-2">Estado</th>
                                    <th className="py-2 pr-2">Origen</th>
                                    <th className="py-2 pr-2">Cargo</th>
                                    <th className="py-2">Detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(rec => {
                                    const meta = RECORD_STATUS_META[rec.status]
                                    const Icon = meta.icon
                                    const detail = rec.status === "failed"
                                        ? (errorMessage(rec.lastError) || "Error")
                                        : describePayload(rec.responsePayload)
                                    const origin = rec.triggeredBy
                                        ? (TRIGGERED_BY_LABELS[rec.triggeredBy] ?? rec.triggeredBy)
                                        : "—"
                                    return (
                                        <tr key={rec.id} className="border-b border-slate-50 last:border-0 align-top">
                                            <td className="py-2.5 pr-2 font-mono text-xs text-slate-400">{rec.id}</td>
                                            <td className="py-2.5 pr-2 text-slate-600 whitespace-nowrap">{formatRunDate(rec.createdAt)}</td>
                                            <td className="py-2.5 pr-2">
                                                <span className={cn("inline-flex items-center gap-1.5 font-medium", meta.className)}>
                                                    <Icon size={14} /> {meta.label}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2 text-slate-500 whitespace-nowrap text-xs">{origin}</td>
                                            <td className="py-2.5 pr-2 text-slate-500 whitespace-nowrap text-xs">
                                                {rec.billable
                                                    ? `Facturable${rec.unitCost != null ? ` · ${rec.unitCost}` : ""}`
                                                    : "Sin cargo"}
                                            </td>
                                            <td className="py-2.5 text-slate-500 break-words">
                                        {detail}
                                        {rec.responsePayload?.pdf_path != null && (
                                            <a
                                                href={`${API_BASE}/checkin/${reservationUuid}/contract/signed`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100 transition-colors"
                                            >
                                                <FileText size={11} /> Ver contrato firmado
                                            </a>
                                        )}
                                    </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

/**
 * Resumen cerrado para el PM. `responsePayload` es un detalle crudo de soporte:
 * nunca se enumeran claves/valores arbitrarios ni se hace JSON.stringify.
 */
export function describePayload(payload: Record<string, unknown> | null): string {
    if (!payload || typeof payload !== "object") return "—"
    if (payload.skipped === true && payload.reason === "no_recipients") {
        return "No se envió: no hay destinatarios configurados."
    }
    if (payload.skipped === true) return "La ejecución fue omitida."
    return "—"
}
