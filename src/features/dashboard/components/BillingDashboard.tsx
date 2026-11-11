"use client"

import { useEffect } from "react"
import { useBalanceStore } from "@/features/billing/hooks/useBalanceStore"
import { useBillingData } from "@/features/billing/hooks/useBillingData"
import { AccountBalanceStrip } from "./AccountBalanceStrip"
import { AccountHistorySummary } from "./AccountHistorySummary"
import { PeriodActivity } from "./PeriodActivity"
import { ReservationCostsList } from "./ReservationCostsList"

/**
 * Billing Tablero body, en tres niveles:
 *  1. Cuenta: el saldo (AccountBalanceStrip).
 *  2. Actividad del mes elegido, con el selector dentro (PeriodActivity).
 *  3. Historial de la cuenta y detalle por reserva.
 *
 * Owns a single data load shared by all of them via useBillingData — the month
 * selector only re-slices it client-side, it never re-queries. El saldo sale de
 * `useBalanceStore`, el mismo del header y del banner.
 */
export function BillingDashboard() {
    const {
        status,
        costs,
        loadingProgress,
        failedReservations,
        refreshFailed,
        rateLimited,
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

    return (
        <div className="flex flex-col gap-8">
            <AccountBalanceStrip
                balance={amount !== null ? { amount, currency } : null}
                isLoadingBalance={amount === null && (!balanceLoaded || balanceLoading)}
                balanceError={balanceError}
                onRetryBalance={refresh}
            />

            <PeriodActivity
                status={status}
                summary={summary}
                monthly={monthly}
                topNodes={topNodes}
                refMonth={refMonth}
                onMonthChange={setRefMonth}
                failedCount={failedReservations.length}
                refreshFailed={refreshFailed}
                rateLimited={rateLimited}
                syncing={syncing}
                loadingProgress={loadingProgress}
                onRetry={retry}
            />

            {/* Nivel 3: fuera de la superficie del selector — no dependen del mes. */}
            <div className="flex flex-col gap-4">
                <AccountHistorySummary summary={summary} isLoading={isLoadingCosts} />
                <ReservationCostsList
                    costs={costs}
                    failedReservations={failedReservations}
                    isLoading={isLoadingCosts}
                    loadingProgress={loadingProgress}
                    unavailable={status === "error" || status === "syncing"}
                />
            </div>
        </div>
    )
}
