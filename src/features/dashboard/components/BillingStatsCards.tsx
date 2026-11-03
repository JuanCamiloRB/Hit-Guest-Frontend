"use client"

import { Card, CardContent } from "@/components/ui/card"
import { format, isSameYear, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Wallet, TrendingUp, TrendingDown, ReceiptText, Calculator } from "lucide-react"
import { RechargeDialog } from "@/features/billing/components/RechargeDialog"
import {
    formatUsd,
    type AccountBalance,
    type ConsumptionSummary,
} from "@/features/billing/types"

interface Props {
    /** Último saldo conocido (el del store compartido); null = no disponible. */
    balance: AccountBalance | null
    isLoadingBalance: boolean
    /** La última consulta falló: con saldo, no se pudo actualizar; sin él, no hay. */
    balanceError?: boolean
    /** Vuelve a pedir el saldo — reintentar es trabajo del cliente, no del usuario con F5. */
    onRetryBalance?: () => void
    /** null = sin datos confiables: las cifras muestran «—», nunca 0. */
    summary: ConsumptionSummary | null
    isLoadingCosts: boolean
    /** Mes elegido en el selector: el de «Consumo del mes» y su variación. */
    refMonth: Date
}

/**
 * Billing KPIs for the Tablero: prepaid balance (+ recharge), month consumption,
 * billed reservations and average cost per reservation. Replaces the old
 * operational KPIs (which duplicated the Operaciones page).
 *
 * Cada cifra dice su alcance. Solo «Consumo del mes» sigue al selector (por
 * fecha de check-in, el criterio del tablero) y lleva su variación contra el
 * mes anterior al elegido. Reservas con consumo facturado (total > 0) y costo
 * promedio son de TODA la cuenta (pedido de producto 2026-10-02): un mes sin
 * reservas los dejaba en 0 y se leían como «no hay nada». La tendencia
 * histórica (`lifetime.avgTrend`) ya no se muestra: no seguía al selector.
 */
export function BillingStatsCards({
    balance,
    isLoadingBalance,
    balanceError = false,
    onRetryBalance,
    summary,
    isLoadingCosts,
    refMonth,
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
                    ) : !balance ? (
                        <div className="space-y-0.5">
                            <div className="text-2xl font-bold text-ink-4">— USD</div>
                            {/* Decía "Pendiente de backend": jerga interna mostrada a quien
                                paga. El cliente necesita saber qué ve y qué hacer, no en qué
                                estado está nuestro roadmap. */}
                            <BalanceNotice text="Saldo no disponible" onRetry={onRetryBalance} />
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-900">
                                    {balance.amount.toLocaleString("es-CO", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                    {balance.currency}
                                </span>
                            </div>
                            {/* El mismo valor que el header: se conserva, pero se dice
                                que puede no ser el actual. */}
                            {balanceError && <BalanceNotice text="No se pudo actualizar" onRetry={onRetryBalance} />}
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
                footer={summary && (
                    <>
                        <p className="text-xs text-muted-foreground">
                            Reservas con check-in en {format(refMonth, "MMMM 'de' yyyy", { locale: es })}
                        </p>
                        <MonthDeltaLine summary={summary} refMonth={refMonth} />
                    </>
                )}
            />

            <KpiCard
                icon={<ReceiptText className="h-4 w-4 text-slate-400" />}
                accent="border-l-slate-200"
                label="RESERVAS CON CONSUMO FACTURADO"
                loading={isLoadingCosts}
                value={summary ? String(summary.lifetime.processedReservations) : "—"}
                footer={summary && <p className="text-xs text-muted-foreground">Desde el inicio de la cuenta</p>}
            />

            <KpiCard
                icon={<Calculator className="h-4 w-4 text-amber-400" />}
                accent="border-l-amber-400"
                label="COSTO PROM. / RESERVA"
                loading={isLoadingCosts}
                value={summary?.lifetime.avgPerReservation != null ? formatUsd(summary.lifetime.avgPerReservation) : "—"}
                footer={summary && (
                    <p className="text-xs text-muted-foreground">Reservas con consumo facturado · desde el inicio de la cuenta</p>
                )}
            />
        </div>
    )
}

function BalanceNotice({ text, onRetry }: { text: string; onRetry?: () => void }) {
    return (
        <p className="text-xs font-medium text-warning">
            {text}
            {onRetry && (
                <>
                    {" · "}
                    <button
                        type="button"
                        onClick={onRetry}
                        className="font-semibold underline underline-offset-2 hover:opacity-80"
                    >
                        Reintentar
                    </button>
                </>
            )}
        </p>
    )
}

function KpiCard({
    icon,
    accent,
    label,
    value,
    loading,
    footer,
}: {
    icon: React.ReactNode
    accent: string
    label: string
    value: string
    loading: boolean
    /** Línea bajo el valor; no se muestra mientras carga. */
    footer?: React.ReactNode
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
                {!loading && footer && <div className="mt-1">{footer}</div>}
            </CardContent>
        </Card>
    )
}

/** Por debajo de esto (0,05 %) el cambio es ruido de redondeo: «sin cambio». */
const FLAT_THRESHOLD = 0.0005

const percent = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 })

/**
 * ¿El mes elegido consumió más o menos que el anterior? Sigue al selector.
 * Subir es la mala noticia para quien paga, así que sube en rojo y baja en
 * verde. Sin consumo el mes anterior no hay base: se dice, sin inventar un %.
 */
export function MonthDeltaLine({ summary, refMonth }: { summary: ConsumptionSummary; refMonth: Date }) {
    const prevMonth = subMonths(refMonth, 1)
    // El año solo cuando cambia (enero vs diciembre del año anterior).
    const prevLabel = format(prevMonth, isSameYear(prevMonth, refMonth) ? "MMMM" : "MMMM yyyy", { locale: es })

    if (summary.monthDeltaPct === null) {
        return <p className="text-xs text-muted-foreground">Sin consumo en {prevLabel} para comparar</p>
    }
    if (Math.abs(summary.monthDeltaPct) < FLAT_THRESHOLD) {
        return <p className="text-xs text-muted-foreground">Sin cambio vs {prevLabel}</p>
    }
    const rising = summary.monthDeltaPct > 0
    const Icon = rising ? TrendingUp : TrendingDown
    return (
        <p
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title={`Consumo de ${format(refMonth, "MMMM yyyy", { locale: es })}: ${formatUsd(summary.monthTotal)}; ${format(prevMonth, "MMMM yyyy", { locale: es })}: ${formatUsd(summary.prevMonthTotal)}`}
        >
            <span className="sr-only">{rising ? "Sube" : "Baja"}</span>
            <span className={`inline-flex items-center gap-0.5 font-semibold ${rising ? "text-red-600" : "text-emerald-600"}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {rising ? "+" : "−"}{percent.format(Math.abs(summary.monthDeltaPct) * 100)} %
            </span>
            <span>vs {prevLabel}</span>
        </p>
    )
}
