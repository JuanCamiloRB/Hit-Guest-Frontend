"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { billingService } from "../services/billing-service"
import { formatUsd, type CreditTransaction, type TransactionsPage } from "../types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusPill, type StatusTone } from "@/components/ui/status-pill"

/** «10 jul 2026, 2:32 p. m.» en la zona horaria local del PM. */
function formatDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("es-CO", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

/*
 * El backend manda códigos (`credit`, `refunded`, `automation_refund`…), no
 * textos: la etiqueta en español es del front. Un código que no está en la
 * tabla se muestra tal cual, para que un valor nuevo se vea y no se disfrace
 * de otro.
 */
const SOURCE_LABELS: Record<string, string> = {
    trial: "Prueba",
    stripe: "Stripe",
    automation: "Automatización",
    automation_refund: "Reembolso",
    manual: "Manual",
}

const TYPE_LABELS: Record<string, string> = {
    credit: "Crédito",
    debit: "Débito",
}

const STATUS_COPY: Record<string, { label: string; tone: StatusTone }> = {
    completed: { label: "Completada", tone: "success" },
    refunded: { label: "Reembolsada", tone: "warning" },
}

function SourceBadge({ source }: { source: string }) {
    const label = SOURCE_LABELS[source] ?? source
    return (
        <Badge>{label}</Badge>
    )
}

function TypeBadge({ type }: { type: string }) {
    const isCredit = type === "credit"
    return (
        <Badge tone={isCredit ? "success" : "neutral"}>
            {TYPE_LABELS[type] ?? type}
        </Badge>
    )
}

function StatusBadge({ status }: { status: string }) {
    const copy = STATUS_COPY[status]
    return (
        <StatusPill tone={copy?.tone ?? "idle"}>
            {copy?.label ?? status}
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
                <h3 className="text-sm font-bold text-ink">Historial de transacciones</h3>
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
                    <p className="text-sm text-ink-3">No se pudo cargar el historial.</p>
                    <Button type="button" variant="link" size="inline"
                        onClick={() => setAttempt((n) => n + 1)}
                    >
                        Reintentar
                    </Button>
                </div>
            ) : !data || data.data.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-3">
                    Aún no hay transacciones. Recarga créditos para empezar.
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-180 text-sm">
                            <thead>
                                <tr className="border-b border-rule text-left text-xs font-bold text-ink-3">
                                    <th className="px-5 py-2.5">Fecha</th>
                                    <th className="px-3 py-2.5">Descripción</th>
                                    <th className="px-3 py-2.5">Tipo</th>
                                    <th className="px-3 py-2.5">Origen</th>
                                    <th className="px-3 py-2.5 text-right">Monto</th>
                                    <th className="px-3 py-2.5 text-right">Saldo</th>
                                    <th className="px-5 py-2.5">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-rule">
                                {data.data.map((tx) => (
                                    <tr key={tx.uuid} className="hover:bg-sunk/50">
                                        <td className="whitespace-nowrap px-5 py-3 text-ink-3">
                                            {formatDate(tx.createdAt)}
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
                            Mostrando {data.from}–{data.to} de {data.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={data.currentPage <= 1 || isLoading}
                                className="inline-flex items-center"
                            >
                                <Icon icon={ChevronLeft} size="sm" /> Anterior
                            </Button>
                            <span className="text-xs font-medium text-ink-3">
                                Página {data.currentPage} de {data.lastPage}
                            </span>
                            <Button type="button" variant="outline" size="sm"
                                onClick={() => setPage((p) => Math.min(data.lastPage, p + 1))}
                                disabled={data.currentPage >= data.lastPage || isLoading}
                                className="inline-flex items-center"
                            >
                                Siguiente <Icon icon={ChevronRight} size="sm" />
                                {isLoading && <Icon icon={Loader2} size="xs" className="ml-1 animate-spin" />}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
