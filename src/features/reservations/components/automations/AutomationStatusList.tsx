"use client"

import { useState } from "react"
import { RefreshCw, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { hasPendingWork, useAutomationStatus } from "@/features/reservations/hooks/useAutomationStatus"
import type { AutomationStatusItem as AutomationStatusItemType } from "@/features/properties/types/automation"
import { AutomationStatusItem } from "./AutomationStatusItem"
import { AutomationHistoryModal } from "./AutomationHistoryModal"
import { isSecondaryGuestAutomation } from "./automation-status-meta"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { Button } from "@/components/ui/button"
import { RefreshIndicator } from "@/components/ui/loading-state"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

interface AutomationStatusListProps {
    reservationUuid: string
    /** Reservation's total guest count — a secondary-guest automation that's
     *  still "not_started" is relabeled "No aplica" instead of "No iniciado"
     *  when there's only 1 guest, since there's no secondary guest for it to
     *  ever run for. */
    totalGuests: number
}

export function AutomationStatusList({ reservationUuid, totalGuests }: AutomationStatusListProps) {
    const { items, isLoading, error, redispatchingKeys, dispatchingKeys, now, cooldownUntil, refresh, redispatch, dispatch, resendPdf } =
        useAutomationStatus(reservationUuid)

    const [historyFor, setHistoryFor] = useState<{ uuid: string; name: string } | null>(null)
    // «Refrescar» vuelve a pedir conservando las tarjetas (el hook no expone ese
    // estado): se marca acá, alrededor de la misma llamada.
    const [refreshing, setRefreshing] = useState(false)
    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            await refresh()
        } finally {
            setRefreshing(false)
        }
    }

    const isPolling = hasPendingWork(items)

    const handleViewHistory = (item: AutomationStatusItemType) => {
        setHistoryFor({ uuid: item.automationUuid, name: item.automationName })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    {/* Era `text-xs uppercase tracking-[0.2em]` en gris claro:
                        el mismo tratamiento que las etiquetas de dato de arriba,
                        así que el encabezado de la sección más importante del
                        panel no se distinguía de un metadato. */}
                    <h4 className="text-sm font-bold text-ink">Automatizaciones</h4>
                    {/* Mientras hay trabajo pendiente el panel vuelve a consultar solo. */}
                    <RefreshIndicator active={!isLoading && (isPolling || refreshing)} />
                </div>
                <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={isLoading || refreshing}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded text-xs font-medium text-ink-3 transition-colors hover:text-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <RefreshCw size={13} aria-hidden className={cn((isLoading || refreshing) && "animate-spin")} />
                    Refrescar
                </button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Skeletons con la forma real de la tarjeta: el spinner
                        centrado hacía saltar el layout al llegar los datos. */}
                    <span className="sr-only" role="status">Cargando automatizaciones…</span>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} aria-hidden className="h-[104px] rounded-xl" />
                    ))}
                </div>
            ) : error ? (
                <FeedbackBanner
                    tone="danger"
                    mode="blocking"
                    action={<Button type="button" size="sm" variant="outline" onClick={refresh}>Reintentar</Button>}
                >
                    {error}
                </FeedbackBanner>
            ) : items.length === 0 ? (
                <EmptyState
                    className="rounded-xl border border-dashed border-rule py-10"
                    icon={<Zap size={22} />}
                    title="No hay automatizaciones configuradas para esta propiedad."
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {items.map(item => (
                        <AutomationStatusItem
                            key={item.automationUuid}
                            item={item}
                            reservationUuid={reservationUuid}
                            now={now}
                            redispatchingKeys={redispatchingKeys}
                            dispatchingKeys={dispatchingKeys}
                            cooldownUntil={cooldownUntil}
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
