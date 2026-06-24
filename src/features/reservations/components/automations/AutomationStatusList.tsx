"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAutomationStatus } from "@/features/reservations/hooks/useAutomationStatus"
import type { AutomationStatusItem as AutomationStatusItemType } from "@/features/properties/types/automation"
import { AutomationStatusItem } from "./AutomationStatusItem"
import { AutomationHistoryModal } from "./AutomationHistoryModal"

interface AutomationStatusListProps {
    reservationUuid: string
}

export function AutomationStatusList({ reservationUuid }: AutomationStatusListProps) {
    const { items, isLoading, error, redispatchingUuids, dispatchingUuids, now, refresh, redispatch, dispatch, resendPdf } =
        useAutomationStatus(reservationUuid)

    const [historyFor, setHistoryFor] = useState<{ uuid: string; name: string } | null>(null)

    const isPolling = items.some(i => i.status === "pending")

    const handleViewHistory = (item: AutomationStatusItemType) => {
        setHistoryFor({ uuid: item.automationUuid, name: item.automationName })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        Estado de Automatización
                    </h4>
                    {isPolling && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500">
                            <Loader2 size={11} className="animate-spin" /> Actualizando
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={13} className={cn(isLoading && "animate-spin")} />
                    Refrescar
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-sm">Cargando automatizaciones...</span>
                </div>
            ) : error ? (
                <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-6 text-center">
                    <p className="text-sm text-red-600">{error}</p>
                    <button
                        type="button"
                        onClick={refresh}
                        className="mt-2 text-xs font-semibold text-red-700 underline"
                    >
                        Reintentar
                    </button>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
                    <div className="rounded-full bg-slate-50 p-3 text-slate-300">
                        <Zap size={22} />
                    </div>
                    <p className="text-sm text-slate-400">
                        No hay automatizaciones configuradas para esta propiedad.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(item => (
                        <AutomationStatusItem
                            key={item.automationUuid}
                            item={item}
                            reservationUuid={reservationUuid}
                            now={now}
                            isRedispatching={redispatchingUuids.has(item.automationUuid)}
                            isDispatching={dispatchingUuids.has(item.automationUuid)}
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
