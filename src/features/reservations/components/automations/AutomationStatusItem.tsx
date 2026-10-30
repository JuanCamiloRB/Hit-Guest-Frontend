"use client"

import { useState } from "react"
import { Loader2, RotateCcw, History, Play, FileText, Send, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type {
    AutomationGuestStatus,
    AutomationStatusItem as AutomationStatusItemType,
} from "@/features/properties/types/automation"
import { automationActionKey } from "@/features/reservations/hooks/useAutomationStatus"
import { StatusPill } from "@/components/ui/status-pill"
import {
    getStatusMeta,
    GUEST_STATUS_META,
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
    /** Claves `automationActionKey` en vuelo: por automatización y por huésped. */
    redispatchingKeys: ReadonlySet<string>
    dispatchingKeys: ReadonlySet<string>
    /** `automationActionKey` → epoch ms hasta el que rige un 429 (lo fija el hook). */
    cooldownUntil: Readonly<Record<string, number>>
    /** True when this is a secondary-guest automation and the reservation only
     *  has 1 total guest — there's no secondary guest for it to ever run for. */
    notApplicable?: boolean
    onRedispatch: (item: AutomationStatusItemType, guest?: AutomationGuestStatus) => void
    onDispatch: (item: AutomationStatusItemType, guest?: AutomationGuestStatus) => void
    onResendPdf: (item: AutomationStatusItemType) => void
    onViewHistory: (item: AutomationStatusItemType) => void
}

export function AutomationStatusItem({
    item,
    reservationUuid,
    now,
    redispatchingKeys,
    dispatchingKeys,
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
    const [confirmingResend, setConfirmingResend] = useState(false)
    const lastRun = formatRunDate(item.lastRunAt)
    const ownKey = automationActionKey(item.automationUuid)
    const isRedispatching = redispatchingKeys.has(ownKey)
    const isDispatching = dispatchingKeys.has(ownKey)
    // Cooldown comes only from an explicit 429 (no proactive lastRunAt block, so
    // admin tokens — exempt from the 5-min limit — are never falsely blocked).
    const ownCooldown = cooldownUntil[ownKey]
    const cooldownLeft = ownCooldown ? Math.max(0, Math.ceil((ownCooldown - now) / 1000)) : 0
    const inCooldown = cooldownLeft > 0
    const retryDisabled = isRedispatching || inCooldown
    // Manual dispatch/redispatch only applies to a fixed set (TRA / SIRE / Guest
    // Report PDF) per product. We gate on that whitelist first — so identity
    // verification, signature, TTLock, etc. never show a manual button even if the
    // backend sends canDispatch/canRedispatch — and still honor an explicit
    // can_manual_dispatch=false from the backend on top of it.
    const canManual =
        !notApplicable && MANUALLY_DISPATCHABLE_SLUGS.has(item.providerSlug) && item.canManualDispatch
    // Por huésped (contrato 2026-10-27 §2.4): se reintenta a cada huésped con
    // su propio `usageRecordId`, en su fila. Arriba solo queda «despachar los
    // pendientes», que el backend reparte entre los huéspedes elegibles.
    const perGuest = item.isPerGuest && item.guests.length > 0
    // Why an action is blocked by an unmet checkin gate (null when not blocked).
    // Only relevant for manually-dispatchable automations — otherwise there's no
    // button to explain, so we don't show a "blocked" note either.
    const blockedMessage = MANUALLY_DISPATCHABLE_SLUGS.has(item.providerSlug)
        ? (getCheckinBlockedMessage(item) ?? getRedispatchBlockedMessage(item))
        : null
    // item.providerSlug is canonicalized (underscore) upstream in normalizeStatusItem.
    const isPdfReport = item.providerSlug === "pdf_report"
    // `POST .../resend-pdf` recibe el UUID de la AUTOMATIZACIÓN y funciona sin
    // importar el estado previo. Exigir `usageRecordId` escondía el botón justo
    // cuando más se necesita: cuando el PDF nunca llegó a enviarse.
    //
    // Sus gates son cuatro —automatización activa, provider `pdf_report`, reserva
    // con el check-in completo y cooldown de 5 minutos—, de los cuales acá solo se
    // pueden anticipar dos; los otros dos llegan como 422/429 al pulsar.
    const canResendPdf = isPdfReport && item.reservationCheckinCompleted
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

            {perGuest && (
                <ul className="space-y-2 border-t border-rule pt-3" aria-label={`Huéspedes de ${title}`}>
                    {item.guests.map((guest) => (
                        <GuestRow
                            key={guest.guestUuid}
                            item={item}
                            guest={guest}
                            canManual={canManual}
                            now={now}
                            redispatchingKeys={redispatchingKeys}
                            dispatchingKeys={dispatchingKeys}
                            cooldownUntil={cooldownUntil}
                            onRedispatch={onRedispatch}
                            onDispatch={onDispatch}
                        />
                    ))}
                </ul>
            )}

            {!perGuest && item.status === "failed" && item.lastError && (
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
                    {canManual && !perGuest && item.canRedispatch ? (
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
                            ) : perGuest ? (
                                <><Play size={14} /> Despachar pendientes</>
                            ) : (
                                <><Play size={14} /> Disparar</>
                            )}
                        </Button>
                    ) : null}

                    {/* Cada reenvío crea un registro de uso NUEVO: se factura otra
                        vez. Por eso el primer clic no envía — pide confirmación y
                        dice el costo. Un solo clic sobre una acción facturable es
                        una factura que el PM no eligió. */}
                    {canResendPdf && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isDispatching || inCooldown}
                            onClick={() => {
                                if (confirmingResend) {
                                    setConfirmingResend(false)
                                    onResendPdf(item)
                                } else {
                                    setConfirmingResend(true)
                                }
                            }}
                            onBlur={() => setConfirmingResend(false)}
                            className={cn(
                                "h-8 gap-1.5 disabled:opacity-60",
                                confirmingResend
                                    ? "border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                    : "border-primary/20 text-primary hover:bg-primary/10 hover:text-primary",
                            )}
                        >
                            {isDispatching ? (
                                <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                            ) : inCooldown ? (
                                <>Espera {formatCooldown(cooldownLeft)}</>
                            ) : confirmingResend ? (
                                <><Send size={14} /> Confirmar — genera un cargo</>
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

/**
 * Un huésped de una automatización por huésped: su estado, su error y SUS
 * acciones, con su propio «en curso» y su propio enfriamiento (el del backend
 * se cuenta por huésped). Los botones salen solo de `canDispatch` /
 * `canRedispatch` del backend.
 */
function GuestRow({
    item,
    guest,
    canManual,
    now,
    redispatchingKeys,
    dispatchingKeys,
    cooldownUntil,
    onRedispatch,
    onDispatch,
}: {
    item: AutomationStatusItemType
    guest: AutomationGuestStatus
    canManual: boolean
    now: number
    redispatchingKeys: ReadonlySet<string>
    dispatchingKeys: ReadonlySet<string>
    cooldownUntil: Readonly<Record<string, number>>
    onRedispatch: (item: AutomationStatusItemType, guest?: AutomationGuestStatus) => void
    onDispatch: (item: AutomationStatusItemType, guest?: AutomationGuestStatus) => void
}) {
    const key = automationActionKey(item.automationUuid, guest.guestUuid)
    const meta = GUEST_STATUS_META[guest.status]
    const until = cooldownUntil[key]
    const cooldownLeft = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
    const inCooldown = cooldownLeft > 0
    const isRedispatching = redispatchingKeys.has(key)
    const isDispatching = dispatchingKeys.has(key)
    const failure = guest.status === "failed" ? errorMessage(guest.lastError) : null

    return (
        <li className="space-y-1.5 rounded-lg bg-sunk/60 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
                        {guest.name}
                        {guest.isMainGuest && <span className="ml-1.5 font-normal text-ink-3">· Titular</span>}
                    </p>
                    {!guest.checkinCompleted && (
                        <p className="text-[11px] text-ink-3">Check-in sin terminar</p>
                    )}
                    {guest.lastRunAt && (
                        <p className="text-[11px] text-ink-3">Última ejecución {formatRunDate(guest.lastRunAt)}</p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <StatusPill tone={meta.tone} emptyLabel={meta.label} className={cn(meta.pulse && "[&>span]:animate-pulse")}>
                        {meta.label}
                    </StatusPill>
                    {canManual && guest.canRedispatch ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isRedispatching || inCooldown}
                            onClick={() => onRedispatch(item, guest)}
                            aria-label={`Reintentar para ${guest.name}`}
                            className="h-7 gap-1 border-danger/30 px-2 text-xs text-danger hover:bg-danger-sunk hover:text-danger disabled:opacity-60"
                        >
                            {isRedispatching ? <Loader2 size={12} className="animate-spin" /> : inCooldown ? formatCooldown(cooldownLeft) : <><RotateCcw size={12} /> Reintentar</>}
                        </Button>
                    ) : canManual && guest.canDispatch ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isDispatching || inCooldown}
                            onClick={() => onDispatch(item, guest)}
                            aria-label={`Despachar para ${guest.name}`}
                            className="h-7 gap-1 border-primary/20 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-60"
                        >
                            {isDispatching ? <Loader2 size={12} className="animate-spin" /> : inCooldown ? formatCooldown(cooldownLeft) : <><Play size={12} /> Despachar</>}
                        </Button>
                    ) : null}
                </div>
            </div>
            {failure && <p className="break-words text-[11px] text-danger">{failure}</p>}
        </li>
    )
}
