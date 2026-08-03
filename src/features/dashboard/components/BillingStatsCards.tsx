"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Wallet, TrendingUp, ReceiptText, Calculator } from "lucide-react"
import { RechargeDialog } from "@/features/billing/components/RechargeDialog"
import {
    formatUsd,
    type AccountBalance,
    type ConsumptionSummary,
} from "@/features/billing/types"

interface Props {
    balance: AccountBalance | null
    balancePending: boolean
    isLoadingBalance: boolean
    summary: ConsumptionSummary | null
    isLoadingCosts: boolean
}

/**
 * Billing KPIs for the Tablero: prepaid balance (+ recharge), month consumption,
 * billed reservations and average cost per reservation. Replaces the old
 * operational KPIs (which duplicated the Operaciones page).
 */
export function BillingStatsCards({
    balance,
    balancePending,
    isLoadingBalance,
    summary,
    isLoadingCosts,
}: Props) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* SALDO — prominent, with recharge */}
            <Card className="border-l-4 border-l-primary shadow-sm bg-gradient-to-br from-primary/5 to-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between pb-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            SALDO
                        </span>
                        <RechargeDialog />
                    </div>
                    {isLoadingBalance ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    ) : balancePending ? (
                        <div className="space-y-0.5">
                            <div className="text-2xl font-bold text-ink-4">— USD</div>
                            {/* Decía "Pendiente de backend": jerga interna mostrada a quien
                                paga. El cliente necesita saber qué ve y qué hacer, no en qué
                                estado está nuestro roadmap. */}
                            <p className="text-xs font-medium text-warning">
                                Saldo no disponible por ahora
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-slate-900">
                                {balance!.amount.toLocaleString("es-CO", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">
                                {balance!.currency}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <KpiCard
                icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
                accent="border-l-emerald-400"
                label="CONSUMO DEL MES"
                loading={isLoadingCosts}
                value={summary ? formatUsd(summary.monthTotal) : "—"}
            />

            <KpiCard
                icon={<ReceiptText className="h-4 w-4 text-slate-400" />}
                accent="border-l-slate-200"
                label="RESERVAS PROCESADAS"
                loading={isLoadingCosts}
                value={summary ? String(summary.billedReservations) : "—"}
            />

            <KpiCard
                icon={<Calculator className="h-4 w-4 text-amber-400" />}
                accent="border-l-amber-400"
                label="COSTO PROM. / RESERVA"
                loading={isLoadingCosts}
                value={summary ? formatUsd(summary.avgPerReservation) : "—"}
            />
        </div>
    )
}

function KpiCard({
    icon,
    accent,
    label,
    value,
    loading,
}: {
    icon: React.ReactNode
    accent: string
    label: string
    value: string
    loading: boolean
}) {
    return (
        <Card className={`border-l-4 ${accent} shadow-sm`}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                        {icon}
                        {label}
                    </span>
                </div>
                <div className="text-2xl font-bold">
                    {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    ) : (
                        value
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
