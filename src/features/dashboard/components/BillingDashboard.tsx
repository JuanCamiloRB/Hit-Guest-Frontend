"use client"

import { useBillingData } from "@/features/billing/hooks/useBillingData"
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
 */
export function BillingDashboard() {
    const {
        balance,
        balancePending,
        isLoadingBalance,
        costs,
        summary,
        monthly,
        topNodes,
        refMonth,
        setRefMonth,
        isLoadingCosts,
    } = useBillingData()

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            {/* Filters sit in one row above everything they scope. */}
            <div className="flex justify-end">
                <MonthSelector value={refMonth} onChange={setRefMonth} />
            </div>

            <BillingStatsCards
                balance={balance}
                balancePending={balancePending}
                isLoadingBalance={isLoadingBalance}
                summary={summary}
                isLoadingCosts={isLoadingCosts}
            />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ConsumptionHistoryChart
                        monthly={monthly}
                        refMonth={refMonth}
                        isLoading={isLoadingCosts}
                    />
                </div>
                <TopNodesPanel
                    topNodes={topNodes}
                    refMonth={refMonth}
                    isLoading={isLoadingCosts}
                />
            </div>

            <ReservationCostsList costs={costs} isLoading={isLoadingCosts} />
        </div>
    )
}
