"use client"

import { useEffect } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useBalanceStore } from "@/features/billing/hooks/useBalanceStore"
import { useBillingData } from "@/features/billing/hooks/useBillingData"
import { cn } from "@/lib/utils"
import { BillingStatsCards } from "./BillingStatsCards"
import { ConsumptionHistoryChart } from "./ConsumptionHistoryChart"
import { MonthSelector } from "./MonthSelector"
import { ReservationCostsList } from "./ReservationCostsList"
import { TopNodesPanel } from "./TopNodesPanel"

/**
 * Billing Tablero body: KPI cards (balance + consumption), the six-month
 * consumption history, the node execution ranking and the per-reservation cost
 * breakdown. Owns a single data load shared by all of them via useBillingData —
 * the month selector only re-slices it client-side, it never re-queries.
 *
 * El saldo sale de `useBalanceStore`, el mismo del header y del banner: los
 * tres muestran siempre el mismo valor.
 */
export function BillingDashboard() {
    const {
        status,
        costs,
        failedReservations,
        refreshFailed,
        syncing,
        summary,
        monthly,
        topNodes,
        refMonth,
        setRefMonth,
        retry,
    } = useBillingData()

    const { amount, currency, isLoading: balanceLoading, loaded: balanceLoaded, error: balanceError, refresh } = useBalanceStore()
    // Al entrar al Tablero el saldo se actualiza (el consumo lo va bajando).
    useEffect(() => {
        void refresh()
    }, [refresh])

    const isLoadingCosts = status === "loading"
    const unavailable = status === "error" || status === "syncing"

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            {/* Filters sit in one row above everything they scope. */}
            <div className="flex flex-wrap items-center justify-end gap-3">
                {status === "refreshing" && (
                    <span role="status" className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Actualizando consumo…
                    </span>
                )}
                <MonthSelector value={refMonth} onChange={setRefMonth} />
            </div>

            {status === "error" && (
                <ConsumptionNotice tone="error" onRetry={retry}>
                    No pudimos cargar la información de consumo.
                </ConsumptionNotice>
            )}
            {syncing && (
                <ConsumptionNotice tone="warning" onRetry={retry}>
                    Las reservas se están sincronizando. Intenta nuevamente en unos segundos.
                </ConsumptionNotice>
            )}
            {failedReservations.length > 0 && (
                <ConsumptionNotice tone="warning" onRetry={retry}>
                    No pudimos consultar el consumo de {failedReservations.length}{" "}
                    {failedReservations.length === 1 ? "reserva" : "reservas"}. Los totales mostrados pueden
                    estar incompletos.
                </ConsumptionNotice>
            )}
            {refreshFailed && (
                <ConsumptionNotice tone="warning" onRetry={retry}>
                    No pudimos actualizar el consumo. Se muestran los últimos datos cargados.
                </ConsumptionNotice>
            )}

            <BillingStatsCards
                balance={amount !== null ? { amount, currency } : null}
                isLoadingBalance={amount === null && (!balanceLoaded || balanceLoading)}
                balanceError={balanceError}
                onRetryBalance={refresh}
                summary={summary}
                isLoadingCosts={isLoadingCosts}
            />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ConsumptionHistoryChart
                        monthly={monthly}
                        refMonth={refMonth}
                        isLoading={isLoadingCosts}
                        unavailable={unavailable}
                    />
                </div>
                <TopNodesPanel
                    topNodes={topNodes}
                    refMonth={refMonth}
                    isLoading={isLoadingCosts}
                    unavailable={unavailable}
                />
            </div>

            <ReservationCostsList
                costs={costs}
                failedReservations={failedReservations}
                isLoading={isLoadingCosts}
                unavailable={unavailable}
            />
        </div>
    )
}

/** Aviso del consumo: rojo si no hay datos, amarillo si están incompletos o viejos. */
function ConsumptionNotice({
    tone,
    onRetry,
    children,
}: {
    tone: "error" | "warning"
    onRetry: () => void
    children: React.ReactNode
}) {
    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            className={cn(
                "flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800",
            )}
        >
            <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{children}</span>
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="shrink-0 self-start rounded-lg px-3 py-1.5 text-sm font-semibold underline underline-offset-2 hover:opacity-80 sm:self-auto"
            >
                Reintentar
            </button>
        </div>
    )
}
