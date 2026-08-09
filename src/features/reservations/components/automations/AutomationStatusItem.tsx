"use client"

import { Loader2, RotateCcw, History, Play, FileText, Send, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AutomationStatusItem as AutomationStatusItemType } from "@/features/properties/types/automation"
import { StatusPill } from "@/components/ui/status-pill"
import {
    getStatusMeta,
    NOT_APPLICABLE_META,
    PROVIDER_LABELS,
    automationTitle,
    formatRunDate,
    formatCooldown,
    getCheckinBlockedMessage,
    getRedispatchBlockedMessage,
    errorMessage,
    MANUALLY_DISPATCHABLE_SLUGS,
} from "./automation-status-meta"
import { API_BASE } from "@/lib/config"

interface AutomationStatusItemProps {
    item: AutomationStatusItemType
    reservationUuid: string
    now: number
    isRedispatching: boolean
    isDispatching: boolean
    /** Epoch ms until which this item is on a 429 cooldown (set by the hook). */
    cooldownUntil?: number
    /** True when this is a secondary-guest automation and the reservation only
     *  has 1 total guest — there's no secondary guest for it to ever run for. */
    notApplicable?: boolean
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
    cooldownUntil,
    notApplicable = false,
    onRedispatch,
    onDispatch,
    onResendPdf,
    onViewHistory,
}: AutomationStatusItemProps) {
    const meta = notApplicable ? NOT_APPLICABLE_META : getStatusMeta(item)
    const title = automationTitle(item.providerSlug, item.automationName)
    const providerLabel = PROVIDER_LABELS[item.providerSlug] || item.providerSlug
    const lastRun = formatRunDate(item.lastRunAt)
    // Cooldown comes only from an explicit 429 (no proactive lastRunAt block, so
    // admin tokens — exempt from the 5-min limit — are never falsely blocked).
    const cooldownLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0
    const inCooldown = cooldownLeft > 0
    const retryDisabled = isRedispatching || inCooldown
    // Manual dispatch/redispatch only applies to a fixed set (TRA / SIRE / Guest
    // Report PDF) per product. We gate on that whitelist first — so identity
    // verification, signature, TTLock, etc. never show a manual button even if the
    // backend sends canDispatch/canRedispatch — and still honor an explicit
    // can_manual_dispatch=false from the backend on top of it.
    const canManual =
        !notApplicable && MANUALLY_DISPATCHABLE_SLUGS.has(item.providerSlug) && item.canManualDispatch !== false
    // Why an action is blocked by an unmet checkin gate (null when not blocked).
    // Only relevant for manually-dispatchable automations — otherwise there's no
    // button to explain, so we don't show a "blocked" note either.
    const blockedMessage = MANUALLY_DISPATCHABLE_SLUGS.has(item.providerSlug)
        ? (getCheckinBlockedMessage(item) ?? getRedispatchBlockedMessage(item))
        : null
    // item.providerSlug is canonicalized (underscore) upstream in normalizeStatusItem.
    const isPdfReport = item.providerSlug === "pdf_report"
    // Resend uses the dedicated POST .../resend-pdf endpoint. Available whenever the
    // PDF ran successfully at least once — even if a later retry failed (wasSuccessful).
    const canResendPdf =
        isPdfReport && (item.status === "completed" || item.wasSuccessful) && item.usageRecordId != null
    const isDigitalContract = item.providerSlug === "hitguest_signature" || item.providerSlug === "tufirma"
    const hasSignedContract = isDigitalContract && item.status === "completed"
    const signedContractUrl = `${API_BASE}/checkin/${reservationUuid}/contract/signed`

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-rule bg-card p-4 transition-colors hover:border-ink-4/60">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {/* Sin `truncate`: el título es lo que identifica la fila, y
                        cortarlo dejaba dos automatizaciones distintas leyéndose
                        igual ("Verificación de identidad · Secundar…"). */}
                    <h4 className="text-sm font-semibold leading-snug text-ink">{title}</h4>
                    <p className="mt-0.5 text-xs text-ink-3">{providerLabel}</p>
                </div>
                <StatusPill
                    tone={meta.tone}
                    emptyLabel={meta.label}
                    className={cn("shrink-0", meta.pulse && "[&>span]:animate-pulse")}
                >
                    {meta.label}
                </StatusPill>
            </div>

            {item.lastRunAt && (
                <p className="text-xs text-ink-3">
                    Última ejecución <span className="font-medium text-ink-2">{lastRun}</span>
                </p>
            )}

            {item.status === "failed" && item.lastError && (
                <p className="rounded-lg bg-danger-sunk px-3 py-2 text-xs break-words text-danger">
                    {errorMessage(item.lastError)}
                </p>
            )}

            {blockedMessage && (
                <p className="inline-flex items-start gap-1.5 rounded-lg bg-sunk px-3 py-2 text-xs break-words text-ink-2">
                    <Lock size={13} className="mt-0.5 shrink-0 text-ink-3" />
                    {blockedMessage}
                </p>
            )}

            {hasSignedContract && (
                <a
                    href={signedContractUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-sunk px-3 py-1.5 text-xs font-semibold text-success transition-opacity hover:opacity-80"
                >
                    <FileText size={13} /> Ver contrato firmado
                </a>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <button
                    type="button"
                    onClick={() => onViewHistory(item)}
                    className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-ink-3 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <History size={14} />
                    Ver historial
                </button>

                <div className="flex items-center gap-2">
                    {canManual && item.canRedispatch ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={retryDisabled}
                            onClick={() => onRedispatch(item)}
                            className="h-8 gap-1.5 border-danger/30 text-danger hover:bg-danger-sunk hover:text-danger disabled:opacity-60"
                        >
                            {isRedispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Reenviando...</>
                            ) : inCooldown ? (
                                <>Espera {formatCooldown(cooldownLeft)}</>
                            ) : (
                                <><RotateCcw size={14} /> Reintentar</>
                            )}
                        </Button>
                    ) : canManual && item.canDispatch ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isDispatching || inCooldown}
                            onClick={() => onDispatch(item)}
                            className="h-8 gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-60"
                        >
                            {isDispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Disparando...</>
                            ) : inCooldown ? (
                                <>Espera {formatCooldown(cooldownLeft)}</>
                            ) : (
                                <><Play size={14} /> Disparar</>
                            )}
                        </Button>
                    ) : null}

                    {canResendPdf && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isDispatching || inCooldown}
                            onClick={() => onResendPdf(item)}
                            className="h-8 gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-60"
                        >
                            {isDispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                            ) : inCooldown ? (
                                <>Espera {formatCooldown(cooldownLeft)}</>
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
