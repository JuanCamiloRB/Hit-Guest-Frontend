"use client"

import { useEffect, useMemo, useState } from "react"
import { Receipt } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable, type DataTableFooterText } from "@/components/shared/data-table"
import { IdentityCell } from "@/components/shared/table-cells"
import { EmptyState } from "@/components/ui/empty-state"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { LoadingState, RefreshIndicator } from "@/components/ui/loading-state"
import { Icon } from "@/components/ui/icon"
import { billingService } from "../services/billing-service"
import { formatUsd, type CreditTransaction, type TransactionsPage } from "../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusPill, type StatusTone } from "@/components/ui/status-pill"
import { useTranslation } from "@/hooks/useTranslation"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"

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

const PAGE_SIZE = 20
const rowId = (tx: CreditTransaction) => tx.uuid

/** La fila apilada de móvil: qué y cuándo arriba, el importe a la derecha, las etiquetas debajo. */
function TransactionMobileRow({ tx, locale }: { tx: CreditTransaction; locale: string }) {
    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <IdentityCell name={tx.description} secondary={formatDate(tx.createdAt, locale)} />
                <AmountCell tx={tx} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={tx.type} />
                <SourceBadge source={tx.source} />
                <StatusBadge status={tx.status} />
            </div>
        </div>
    )
}

/**
 * Historial paginado de transacciones de crédito (20 por página, más recientes
 * primero). Es la tabla compartida con paginación del SERVIDOR: el pie dice lo
 * que contó el backend y cambiar de página deja la anterior a la vista hasta
 * que llega la nueva (nunca vuelve al esqueleto).
 */
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

    const locale = t("common.dateLocale")
    const columns = useMemo<ColumnDef<CreditTransaction>[]>(() => [
        {
            id: "date",
            header: t("billing.history.columns.date"),
            cell: ({ row }) => <span className="text-ink-3">{formatDate(row.original.createdAt, locale)}</span>,
        },
        {
            id: "description",
            header: t("billing.history.columns.description"),
            meta: { cellClassName: "min-w-48 whitespace-normal" },
            cell: ({ row }) => <span className="text-sm text-ink-2">{row.original.description}</span>,
        },
        { id: "type", header: t("billing.history.columns.type"), cell: ({ row }) => <TypeBadge type={row.original.type} /> },
        { id: "source", header: t("billing.history.columns.source"), cell: ({ row }) => <SourceBadge source={row.original.source} /> },
        {
            id: "amount",
            header: () => <span className="block text-right">{t("billing.history.columns.amount")}</span>,
            meta: { cellClassName: "text-right" },
            cell: ({ row }) => <AmountCell tx={row.original} />,
        },
        {
            id: "balance",
            header: () => <span className="block text-right">{t("billing.history.columns.balance")}</span>,
            meta: { cellClassName: "text-right" },
            cell: ({ row }) => <span className="tabular-nums text-ink-3">{formatUsd(row.original.balanceAfter)}</span>,
        },
        { id: "status", header: t("billing.history.columns.status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ], [t, locale])
    const footerText = useMemo<Partial<DataTableFooterText>>(() => ({
        range: (from, to, total) => t("billing.history.showing", { from, to, total }),
        page: (current, last) => t("billing.history.page", { page: current, last }),
        previous: t("common.previous"),
        next: t("common.next"),
    }), [t])

    return (
        <Surface flat>
            <div className="flex items-center gap-2 border-b border-rule px-5 py-4">
                <Icon icon={Receipt} className="text-primary" />
                <Heading level={3} size="subsection">{t("billing.history.title")}</Heading>
                <RefreshIndicator active={isLoading && data !== null} label={t("common.updating")} />
            </div>

            <div className="p-4">
                {isLoading && data === null ? (
                    <LoadingState rows={6} label={t("common.loading")} />
                ) : error && data === null ? (
                    <FeedbackBanner
                        tone="danger"
                        mode="blocking"
                        title={t("billing.history.loadError")}
                        action={<Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>{t("common.retry")}</Button>}
                    />
                ) : (
                    <>
                        {error && (
                            // Una página que no llegó: se sigue viendo la anterior.
                            <FeedbackBanner
                                tone="warning"
                                className="mb-3"
                                title={t("billing.history.loadError")}
                                action={<Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>{t("common.retry")}</Button>}
                            />
                        )}
                        <DataTable
                            columns={columns}
                            data={data?.data ?? []}
                            getRowId={rowId}
                            pageSize={PAGE_SIZE}
                            itemLabel={HISTORY_LABEL}
                            footerText={footerText}
                            renderMobileRow={(tx) => <TransactionMobileRow tx={tx} locale={locale} />}
                            serverPagination={{
                                pageIndex: (data?.currentPage ?? page) - 1,
                                pageCount: data?.lastPage ?? 1,
                                total: data?.total ?? null,
                                range: data ? { from: data.from, to: data.to } : undefined,
                                // Siempre vuelve a pedir: si la página 2 falló, `page` ya es 2
                                // y sin esto «Siguiente» no hacía nada (solo «Reintentar»).
                                onPageChange: (index) => { setPage(index + 1); setAttempt((n) => n + 1) },
                                loading: isLoading,
                            }}
                            empty={<EmptyState title={t("billing.history.empty")} />}
                        />
                    </>
                )}
            </div>
        </Surface>
    )
}

/** El rango lo escribe el diccionario («Mostrando 1–20 de 45»): sin sustantivo propio. */
const HISTORY_LABEL = { singular: "", plural: "" }
