"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react"
import { billingService } from "../services/billing-service"
import { formatUsd, type CreditTransaction, type TransactionsPage } from "../types"
import { UnstyledButton } from "@/components/ui/unstyled-button"

/** "Jul 10, 2026 2:32 PM" in the PM's local timezone. */
function formatDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })
}

const SOURCE_LABELS: Record<string, string> = {
    trial: "Trial",
    stripe: "Stripe",
    automation: "Automation",
    automation_refund: "Refund",
    manual: "Manual",
}

function SourceBadge({ source }: { source: string }) {
    const label = SOURCE_LABELS[source] ?? source
    return (
        <span className="inline-flex rounded-full bg-sunk px-2 py-0.5 text-xs font-semibold text-ink-2">
            {label}
        </span>
    )
}

function TypeBadge({ type }: { type: string }) {
    const isCredit = type === "credit"
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                isCredit ? "bg-success-sunk text-success" : "bg-sunk text-ink-3"
            }`}
        >
            {isCredit ? "Credit" : "Debit"}
        </span>
    )
}

function StatusBadge({ status }: { status: string }) {
    const refunded = status === "refunded"
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                refunded ? "bg-warning-sunk text-warning" : "bg-success-sunk text-success"
            }`}
        >
            {refunded ? "Refunded" : "Completed"}
        </span>
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

/** Paginated credit-transaction history (20/page, newest first). */
export function TransactionHistory() {
    const [page, setPage] = useState(1)
    const [data, setData] = useState<TransactionsPage | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(false)

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
    }, [page])

    return (
        <div className="rounded-2xl border border-rule bg-white">
            <div className="flex items-center gap-2 border-b border-rule px-5 py-4">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-ink">Historial de transacciones</h3>
            </div>

            {isLoading ? (
                <div className="divide-y divide-rule">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="h-4 flex-1 animate-pulse rounded bg-sunk" />
                            <div className="h-4 w-16 animate-pulse rounded bg-sunk" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <p className="text-sm text-ink-3">Failed to load transactions.</p>
                    <UnstyledButton
                        onClick={() => setPage((p) => p)}
                        className="text-xs font-semibold text-primary underline"
                    >
                        Retry
                    </UnstyledButton>
                </div>
            ) : !data || data.data.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-3">
                    No transactions yet. Recharge to get started.
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="border-b border-rule text-left text-xs font-bold uppercase tracking-wide text-ink-3">
                                    <th className="px-5 py-2.5">Date</th>
                                    <th className="px-3 py-2.5">Description</th>
                                    <th className="px-3 py-2.5">Type</th>
                                    <th className="px-3 py-2.5">Source</th>
                                    <th className="px-3 py-2.5 text-right">Amount</th>
                                    <th className="px-3 py-2.5 text-right">Balance</th>
                                    <th className="px-5 py-2.5">Status</th>
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
                            Showing {data.from}–{data.to} of {data.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <UnstyledButton
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={data.currentPage <= 1 || isLoading}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rule px-2.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-sunk/50 disabled:opacity-40"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" /> Previous
                            </UnstyledButton>
                            <span className="text-xs font-medium text-ink-3">
                                Page {data.currentPage} of {data.lastPage}
                            </span>
                            <UnstyledButton
                                onClick={() => setPage((p) => Math.min(data.lastPage, p + 1))}
                                disabled={data.currentPage >= data.lastPage || isLoading}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rule px-2.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-sunk/50 disabled:opacity-40"
                            >
                                Next <ChevronRight className="h-3.5 w-3.5" />
                                {isLoading && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
                            </UnstyledButton>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
