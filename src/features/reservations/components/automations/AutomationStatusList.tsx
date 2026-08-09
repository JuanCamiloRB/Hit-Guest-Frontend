"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAutomationStatus } from "@/features/reservations/hooks/useAutomationStatus"
import type { AutomationStatusItem as AutomationStatusItemType } from "@/features/properties/types/automation"
import { AutomationStatusItem } from "./AutomationStatusItem"
import { AutomationHistoryModal } from "./AutomationHistoryModal"
import { isSecondaryGuestAutomation } from "./automation-status-meta"

interface AutomationStatusListProps {
    reservationUuid: string
    /** Reservation's total guest count — a secondary-guest automation that's
     *  still "not_started" is relabeled "No aplica" instead of "No iniciado"
     *  when there's only 1 guest, since there's no secondary guest for it to
     *  ever run for. */
    totalGuests: number
}

export function AutomationStatusList({ reservationUuid, totalGuests }: AutomationStatusListProps) {
    const { items, isLoading, error, redispatchingUuids, dispatchingUuids, now, cooldownUntil, refresh, redispatch, dispatch, resendPdf } =
        useAutomationStatus(reservationUuid)

    const [historyFor, setHistoryFor] = useState<{ uuid: string; name: string } | null>(null)

    const isPolling = items.some(i => i.status === "pending")

    const handleViewHistory = (item: AutomationStatusItemType) => {
        setHistoryFor({ uuid: item.automationUuid, name: item.automationName })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    {/* Era `text-[10px] uppercase tracking-[0.2em]` en gris claro:
                        el mismo tratamiento que las etiquetas de dato de arriba,
                        así que el encabezado de la sección más importante del
                        panel no se distinguía de un metadato. */}
                    <h4 className="text-sm font-bold text-ink">Automatizaciones</h4>
                    {isPolling && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                            <Loader2 size={11} className="animate-spin" /> Actualizando
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={isLoading}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded text-xs font-medium text-ink-3 transition-colors hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <RefreshCw size={13} className={cn(isLoading && "animate-spin")} />
                    Refrescar
                </button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Skeletons con la forma real de la tarjeta: el spinner
                        centrado hacía saltar el layout al llegar los datos. */}
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-[104px] animate-pulse rounded-xl border border-rule bg-sunk" />
                    ))}
                </div>
            ) : error ? (
                <div className="rounded-xl bg-danger-sunk px-4 py-6 text-center">
                    <p className="text-sm text-danger">{error}</p>
                    <button
                        type="button"
                        onClick={refresh}
                        className="mt-2 text-xs font-semibold text-danger underline underline-offset-2"
                    >
                        Reintentar
                    </button>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-rule py-10 text-center">
                    <div className="rounded-full bg-sunk p-3 text-ink-4">
                        <Zap size={22} />
                    </div>
                    <p className="text-sm text-ink-3">
                        No hay automatizaciones configuradas para esta propiedad.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {items.map(item => (
                        <AutomationStatusItem
                            key={item.automationUuid}
                            item={item}
                            reservationUuid={reservationUuid}
                            now={now}
                            isRedispatching={redispatchingUuids.has(item.automationUuid)}
                            isDispatching={dispatchingUuids.has(item.automationUuid)}
                            cooldownUntil={cooldownUntil[item.automationUuid]}
                            notApplicable={
                                totalGuests <= 1
                                && item.status === "not_started"
                                && isSecondaryGuestAutomation(item.automationName)
                            }
                            onRedispatch={redispatch}
                            onDispatch={dispatch}
                            onResendPdf={resendPdf}
                            onViewHistory={handleViewHistory}
                        />
                    ))}
                </div>
            )}

            <AutomationHistoryModal
                reservationUuid={reservationUuid}
                automation={historyFor}
                onClose={() => setHistoryFor(null)}
            />
        </div>
    )
}
