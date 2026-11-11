"use client"

import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ConsumptionStatus } from "@/features/billing/hooks/useBillingData"
import type { ConsumptionSummary, MonthlyPoint, NodeUsage } from "@/features/billing/types"
import { cn } from "@/lib/utils"
import { ActivitySummary } from "./ActivitySummary"
import { ConsumptionHistoryChart } from "./ConsumptionHistoryChart"
import { DASHBOARD_SURFACE } from "./dashboard-surface"
import { MonthSelector } from "./MonthSelector"
import { TopNodesPanel } from "./TopNodesPanel"
import { UnstyledButton } from "@/components/ui/unstyled-button"

interface Props {
    status: ConsumptionStatus
    summary: ConsumptionSummary | null
    monthly: MonthlyPoint[]
    topNodes: NodeUsage[]
    refMonth: Date
    onMonthChange: (month: Date) => void
    /** Reservas cuyo consumo no se pudo consultar: las cifras pueden estar incompletas. */
    failedCount: number
    /** Una actualización falló y se ven los últimos datos cargados. */
    refreshFailed: boolean
    /** Reservas respondió 202 (sincronizando). */
    syncing: boolean
    /** Avance de la carga inicial: las cifras esperan al total, pero se dice cuánto falta. */
    loadingProgress?: { done: number; total: number } | null
    onRetry: () => void
}

/**
 * Nivel 2 del Tablero: la actividad del mes elegido. El selector vive AQUÍ
 * porque solo gobierna lo que está dentro: consumo, variación, historial y
 * nodos (no el saldo, ni las cifras históricas, ni la tabla).
 *
 * Cada estado se resuelve dentro de este nivel:
 * - carga inicial → skeleton con la geometría final;
 * - refresh → datos visibles + «Actualizando…»;
 * - error o 202 SIN datos → un único mensaje en lugar del análisis;
 * - error o 202 CON datos → los datos anteriores + un aviso discreto
 *   (un fallo nunca borra información válida, fase 1);
 * - parcial → aviso antes del análisis (las filas fallidas, en la tabla).
 */
export function PeriodActivity({
    status,
    summary,
    monthly,
    topNodes,
    refMonth,
    onMonthChange,
    failedCount,
    refreshFailed,
    syncing,
    loadingProgress = null,
    onRetry,
}: Props) {
    return (
        <section aria-labelledby="period-activity-title" className={DASHBOARD_SURFACE}>
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-rule px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <h2 id="period-activity-title" className="text-base font-semibold text-ink">
                        Actividad del mes
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-3">Consumo, historial y nodos del mes elegido</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {status === "refreshing" && (
                        <span role="status" className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            Actualizando…
                        </span>
                    )}
                    <MonthSelector value={refMonth} onChange={onMonthChange} />
                </div>
            </header>

            <div className="flex flex-col gap-6 px-5 py-5 sm:px-6 sm:py-6">
                {status === "loading" ? (
                    <ActivitySkeleton progress={loadingProgress} />
                ) : !summary ? (
                    // Sin datos confiables: un solo mensaje en lugar del análisis.
                    status === "syncing" ? (
                        <ActivityMessage
                            role="status"
                            icon={<RefreshCw className="h-5 w-5 text-ink-3" aria-hidden />}
                            title="Las reservas se están sincronizando"
                            description="Intenta nuevamente en unos segundos."
                            onRetry={onRetry}
                        />
                    ) : (
                        <ActivityMessage
                            role="alert"
                            icon={<AlertTriangle className="h-5 w-5 text-danger" aria-hidden />}
                            title="No pudimos cargar la información de consumo."
                            onRetry={onRetry}
                        />
                    )
                ) : (
                    <>
                        {refreshFailed && (
                            <ActivityNotice onRetry={onRetry}>
                                No pudimos actualizar el consumo. Se muestran los últimos datos cargados.
                            </ActivityNotice>
                        )}
                        {syncing && (
                            <ActivityNotice onRetry={onRetry}>
                                Las reservas se están sincronizando. Se muestran los últimos datos cargados.
                            </ActivityNotice>
                        )}
                        {failedCount > 0 && (
                            <ActivityNotice onRetry={onRetry}>
                                No se pudo consultar el consumo de {failedCount}{" "}
                                {failedCount === 1 ? "reserva" : "reservas"}. Las cifras mostradas pueden estar incompletas.
                            </ActivityNotice>
                        )}

                        <ActivitySummary summary={summary} refMonth={refMonth} />

                        {/* Historial y nodos: un mismo análisis, un único divisor. */}
                        <div className="grid gap-6 border-t border-rule pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-0">
                            <div className="min-w-0 lg:pr-8">
                                <ConsumptionHistoryChart monthly={monthly} refMonth={refMonth} />
                            </div>
                            <div className="min-w-0 border-t border-rule pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                                <TopNodesPanel topNodes={topNodes} refMonth={refMonth} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </section>
    )
}

/** Aviso discreto dentro del nivel: los datos siguen a la vista. */
function ActivityNotice({ onRetry, children }: { onRetry: () => void; children: React.ReactNode }) {
    return (
        <div
            role="status"
            className="flex flex-col gap-1 rounded-lg bg-warning-sunk px-3 py-2 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
            <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                <span>{children}</span>
            </p>
            <RetryButton onRetry={onRetry} className="self-start sm:self-auto" />
        </div>
    )
}

/** Mensaje único que ocupa el lugar del análisis cuando no hay datos confiables. */
function ActivityMessage({
    role,
    icon,
    title,
    description,
    onRetry,
}: {
    role: "alert" | "status"
    icon: React.ReactNode
    title: string
    description?: string
    onRetry: () => void
}) {
    return (
        <div role={role} className="flex min-h-72 flex-col items-center justify-center gap-2 text-center">
            {icon}
            <p className="text-sm font-semibold text-ink">{title}</p>
            {description && <p className="text-sm text-ink-3">{description}</p>}
            <RetryButton onRetry={onRetry} className="mt-1" />
        </div>
    )
}

function RetryButton({ onRetry, className }: { onRetry: () => void; className?: string }) {
    return (
        <UnstyledButton
            type="button"
            onClick={onRetry}
            className={cn("shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline", className)}
        >
            Reintentar
        </UnstyledButton>
    )
}

/**
 * Skeleton con la forma final: cifra, variación, historial y nodos. Las cifras
 * salen solo con todas las reservas consultadas (un total parcial mentiría),
 * así que mientras tanto se dice cuántas van.
 */
function ActivitySkeleton({ progress }: { progress: { done: number; total: number } | null }) {
    return (
        <div role="status" aria-label="Cargando la actividad del mes" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-8 w-44" />
                {progress ? (
                    <p className="text-sm text-ink-3">
                        Calculando el consumo · {progress.done} de {progress.total} reservas
                    </p>
                ) : (
                    <Skeleton className="h-3.5 w-56" />
                )}
            </div>
            <div className="grid gap-6 border-t border-rule pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-0">
                <div className="min-w-0 lg:pr-8">
                    <Skeleton className="h-4 w-24" />
                    <div className="mt-4 flex h-48 items-end gap-2 pb-6">
                        {[40, 65, 30, 80, 55, 70].map((h, i) => (
                            <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
                <div className="min-w-0 border-t border-rule pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                    <Skeleton className="h-4 w-32" />
                    <div className="mt-4 flex flex-col gap-4">
                        {[90, 70, 55, 40].map((w, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                                <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
                                <Skeleton className="h-1.5 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <span className="sr-only">Cargando…</span>
        </div>
    )
}
