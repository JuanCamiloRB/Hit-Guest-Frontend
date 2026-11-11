"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { billingService } from "../services/billing-service"
import { formatUsd, type CreditTransaction, type TransactionsPage } from "../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusPill, type StatusTone } from "@/components/ui/status-pill"
import { useTranslation } from "@/hooks/useTranslation"

/** «10 jul 2026, 2:32 p. m.» en la zona horaria local del PM. */
function formatDate(iso: string, locale: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

/*
 * El backend manda códigos (`credit`, `refunded`, `automation_refund`…), no
 * textos: la etiqueta sale del diccionario del idioma activo. Un código que no
 * está en la tabla se muestra tal cual, para que un valor nuevo se vea y no se
 * disfrace de otro. `hasOwn` evita que «constructor» o «toString» resuelvan a
 * algo del prototipo.
 */
function labelFor(table: Readonly<Record<string, string>>, code: string): string {
    return Object.hasOwn(table, code) ? table[code] : code
}

const STATUS_TONE: Record<string, StatusTone> = {
    completed: "success",
    refunded: "warning",
}

function SourceBadge({ source }: { source: string }) {
    const { dictionary } = useTranslation()
    return <Badge>{labelFor(dictionary.billing.history.sources, source)}</Badge>
}

function TypeBadge({ type }: { type: string }) {
    const { dictionary } = useTranslation()
    return (
        <Badge tone={type === "credit" ? "success" : "neutral"}>
            {labelFor(dictionary.billing.history.types, type)}
        </Badge>
    )
}

function StatusBadge({ status }: { status: string }) {
    const { dictionary } = useTranslation()
    return (
        <StatusPill tone={Object.hasOwn(STATUS_TONE, status) ? STATUS_TONE[status] : "idle"}>
            {labelFor(dictionary.billing.history.statuses, status)}
        </StatusPill>
    )
}

function AmountCell({ tx }: { tx: CreditTransaction }) {
    const isCredit = tx.type === "credit"
    return (
        <span className={`font-bold tabular-nums ${isCredit ? "text-success" : "text-ink-2"}`}>
            {isCredit ? "+" : "−"}
            {formatUsd(tx.amount)}
        </span>
    )
}

/** Historial paginado de transacciones de crédito (20 por página, más recientes primero). */
export function TransactionHistory() {
    const { t } = useTranslation()
    const [page, setPage] = useState(1)
    const [data, setData] = useState<TransactionsPage | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(false)
    // Reintentar con la misma página no cambia `page`: este contador es lo que
    // vuelve a disparar la carga.
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let mounted = true
        setIsLoading(true)
        setError(false)
        billingService
            .getTransactions(page)
            .then((res) => mounted && setData(res))
            .catch(() => mounted && setError(true))
            .finally(() => mounted && setIsLoading(false))
        return () => {
            mounted = false
        }
    }, [page, attempt])

    return (
        <div className="rounded-xl border border-rule bg-white">
            <div className="flex items-center gap-2 border-b border-rule px-5 py-4">
                <Icon icon={Receipt} className="text-primary" />
                <h3 className="text-sm font-bold text-ink">{t("billing.history.title")}</h3>
            </div>

            {isLoading ? (
                <div className="divide-y divide-rule">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="h-4 flex-1 animate-pulse rounded-xs bg-sunk" />
                            <div className="h-4 w-16 animate-pulse rounded-xs bg-sunk" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <p className="text-sm text-ink-3">{t("billing.history.loadError")}</p>
                    <Button type="button" variant="link" size="inline"
                        onClick={() => setAttempt((n) => n + 1)}
                    >
                        {t("common.retry")}
                    </Button>
                </div>
            ) : !data || data.data.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-3">
                    {t("billing.history.empty")}
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-180 text-sm">
                            <thead>
                                <tr className="border-b border-rule text-left text-xs font-bold text-ink-3">
                                    <th className="px-5 py-2.5">{t("billing.history.columns.date")}</th>
                                    <th className="px-3 py-2.5">{t("billing.history.columns.description")}</th>
                                    <th className="px-3 py-2.5">{t("billing.history.columns.type")}</th>
                                    <th className="px-3 py-2.5">{t("billing.history.columns.source")}</th>
                                    <th className="px-3 py-2.5 text-right">{t("billing.history.columns.amount")}</th>
                                    <th className="px-3 py-2.5 text-right">{t("billing.history.columns.balance")}</th>
                                    <th className="px-5 py-2.5">{t("billing.history.columns.status")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-rule">
                                {data.data.map((tx) => (
                                    <tr key={tx.uuid} className="hover:bg-sunk/50">
                                        <td className="whitespace-nowrap px-5 py-3 text-ink-3">
                                            {formatDate(tx.createdAt, t("common.dateLocale"))}
                                        </td>
                                        <td className="px-3 py-3 text-ink-2">{tx.description}</td>
                                        <td className="px-3 py-3"><TypeBadge type={tx.type} /></td>
                                        <td className="px-3 py-3"><SourceBadge source={tx.source} /></td>
                                        <td className="px-3 py-3 text-right"><AmountCell tx={tx} /></td>
                                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink-3">
                                            {formatUsd(tx.balanceAfter)}
                                        </td>
                                        <td className="px-5 py-3"><StatusBadge status={tx.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-rule px-5 py-3">
                        <p className="text-xs text-ink-3">
                            {t("billing.history.showing", { from: data.from, to: data.to, total: data.total })}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={data.currentPage <= 1 || isLoading}
                                className="inline-flex items-center"
                            >
                                <Icon icon={ChevronLeft} size="sm" /> {t("common.previous")}
                            </Button>
                            <span className="text-xs font-medium text-ink-3">
                                {t("billing.history.page", { page: data.currentPage, last: data.lastPage })}
                            </span>
                            <Button type="button" variant="outline" size="sm"
                                onClick={() => setPage((p) => Math.min(data.lastPage, p + 1))}
                                disabled={data.currentPage >= data.lastPage || isLoading}
                                className="inline-flex items-center"
                            >
                                {t("common.next")} <Icon icon={ChevronRight} size="sm" />
                                {isLoading && <Icon icon={Loader2} size="xs" className="ml-1 animate-spin" />}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
