"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { billingService } from "../services/billing-service"
import { formatUsd, type CreditTransaction, type TransactionsPage } from "../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusPill, type StatusTone } from "@/components/ui/status-pill"
import { useTranslation } from "@/hooks/useTranslation"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

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
        <Surface flat>
            <div className="flex items-center gap-2 border-b border-rule px-5 py-4">
                <Icon icon={Receipt} className="text-primary" />
                <Heading level={3} size="subsection">{t("billing.history.title")}</Heading>
            </div>

            {isLoading ? (
                <div className="divide-y divide-rule">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-16" />
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
                    <Table className="min-w-180">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-5 py-2.5">{t("billing.history.columns.date")}</TableHead>
                                    <TableHead className="px-3 py-2.5">{t("billing.history.columns.description")}</TableHead>
                                    <TableHead className="px-3 py-2.5">{t("billing.history.columns.type")}</TableHead>
                                    <TableHead className="px-3 py-2.5">{t("billing.history.columns.source")}</TableHead>
                                    <TableHead className="px-3 py-2.5 text-right">{t("billing.history.columns.amount")}</TableHead>
                                    <TableHead className="px-3 py-2.5 text-right">{t("billing.history.columns.balance")}</TableHead>
                                    <TableHead className="px-5 py-2.5">{t("billing.history.columns.status")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.data.map((tx) => (
                                    <TableRow key={tx.uuid}>
                                        <TableCell className="whitespace-nowrap px-5 py-3 text-ink-3">
                                            {formatDate(tx.createdAt, t("common.dateLocale"))}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 whitespace-normal text-ink-2">{tx.description}</TableCell>
                                        <TableCell className="px-3 py-3"><TypeBadge type={tx.type} /></TableCell>
                                        <TableCell className="px-3 py-3"><SourceBadge source={tx.source} /></TableCell>
                                        <TableCell className="px-3 py-3 text-right"><AmountCell tx={tx} /></TableCell>
                                        <TableCell className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink-3">
                                            {formatUsd(tx.balanceAfter)}
                                        </TableCell>
                                        <TableCell className="px-5 py-3"><StatusBadge status={tx.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

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
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.lastPage, p + 1))} disabled={data.currentPage >= data.lastPage} className="inline-flex items-center" loading={isLoading}>
                                {t("common.next")} <Icon icon={ChevronRight} size="sm" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </Surface>
    )
}
