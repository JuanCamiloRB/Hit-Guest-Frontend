"use client"

import { Loader2, RotateCcw, History, Play, FileText, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AutomationStatusItem as AutomationStatusItemType } from "@/features/properties/types/automation"
import { getCooldownSecondsRemaining } from "@/features/reservations/hooks/useAutomationStatus"
import { STATUS_META, PROVIDER_LABELS, formatRunDate, formatCooldown } from "./automation-status-meta"
import { API_BASE } from "@/lib/config"

interface AutomationStatusItemProps {
    item: AutomationStatusItemType
    reservationUuid: string
    now: number
    isRedispatching: boolean
    isDispatching: boolean
    onRedispatch: (item: AutomationStatusItemType) => void
    onDispatch: (item: AutomationStatusItemType) => void
    onResendPdf: (item: AutomationStatusItemType) => void
    onViewHistory: (item: AutomationStatusItemType) => void
}

export function AutomationStatusItem({
    item,
    reservationUuid,
    now,
    isRedispatching,
    isDispatching,
    onRedispatch,
    onDispatch,
    onResendPdf,
    onViewHistory,
}: AutomationStatusItemProps) {
    const meta = STATUS_META[item.status]
    const providerLabel = PROVIDER_LABELS[item.providerSlug] || item.providerSlug
    const cooldownLeft = item.canRedispatch ? getCooldownSecondsRemaining(item, now) : 0
    const inCooldown = cooldownLeft > 0
    const retryDisabled = isRedispatching || inCooldown
    const isPdfReport = item.providerSlug === "pdf-report"
    // Resend uses the dedicated POST .../resend-pdf endpoint (allowed for completed).
    const canResendPdf = isPdfReport && item.status === "completed" && item.usageRecordId != null
    const isDigitalContract = item.providerSlug === "hitguest_signature" || item.providerSlug === "tufirma"
    const hasSignedContract = isDigitalContract && item.status === "completed"
    const signedContractUrl = `${API_BASE}/checkin/${reservationUuid}/contract/signed`

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                    <div className="min-w-0">
                        <h4 className="font-semibold text-slate-800 leading-tight truncate">{item.automationName}</h4>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{providerLabel}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", meta.badge)}>
                        {meta.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{formatRunDate(item.lastRunAt)}</span>
                </div>
            </div>

            {item.status === "failed" && item.lastError && (
                <p className="rounded-lg bg-red-50/60 border border-red-100 px-3 py-2 text-xs text-red-600 break-words">
                    {item.lastError}
                </p>
            )}

            {hasSignedContract && (
                <a
                    href={signedContractUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 w-fit rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                    <FileText size={13} /> Ver contrato firmado
                </a>
            )}


            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => onViewHistory(item)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    <History size={14} />
                    Ver historial
                </button>

                <div className="flex items-center gap-2">
                    {item.canRedispatch ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={retryDisabled}
                            onClick={() => onRedispatch(item)}
                            className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                        >
                            {isRedispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Reenviando...</>
                            ) : inCooldown ? (
                                <>Espera {formatCooldown(cooldownLeft)}</>
                            ) : (
                                <><RotateCcw size={14} /> Reintentar</>
                            )}
                        </Button>
                    ) : item.status === "not_started" ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isDispatching}
                            onClick={() => onDispatch(item)}
                            className="h-8 gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
                        >
                            {isDispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Disparando...</>
                            ) : (
                                <><Play size={14} /> Disparar</>
                            )}
                        </Button>
                    ) : null}

                    {canResendPdf && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isDispatching}
                            onClick={() => onResendPdf(item)}
                            className="h-8 gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-60"
                        >
                            {isDispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                            ) : (
                                <><Send size={14} /> Reenviar PDF</>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
