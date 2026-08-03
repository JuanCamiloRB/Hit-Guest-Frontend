"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Wallet, Plus } from "lucide-react"
import { ApiError } from "@/types/api"
import { billingService, BillingNotConfiguredError } from "../services/billing-service"
import { useBalanceStore } from "../hooks/useBalanceStore"
import { TransactionHistory } from "./TransactionHistory"
import {
    formatUsd,
    getBalanceState,
    type BillingPackage,
    type PackagesInfo,
} from "../types"

/** Balance card + recharge (packages/custom) + transaction history. */
export function BillingSettings() {
    const { amount, currency, isLoading: balanceLoading, pending, refresh } = useBalanceStore()

    const [packages, setPackages] = useState<PackagesInfo | null>(null)
    const [selected, setSelected] = useState<number | null>(null)
    const [custom, setCustom] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [amountError, setAmountError] = useState<string | null>(null)

    // Always refetch the balance when the PM lands here (per the spec).
    useEffect(() => {
        refresh()
    }, [refresh])

    useEffect(() => {
        billingService
            .getPackages()
            .then((p) => {
                setPackages(p)
                if (p?.packages?.length) setSelected(p.packages[0].amount)
            })
            .catch(() => setPackages(null))
    }, [])

    const minimum = packages?.minimumCustom ?? 10
    const customNum = custom.trim() === "" ? null : Number(custom)
    // The effective amount is the custom value when entered, else the selected package.
    const effectiveAmount = customNum != null ? customNum : selected

    const validate = (value: number | null): string | null => {
        if (value == null || Number.isNaN(value)) return "Ingresa un monto válido."
        if (value < minimum) return `El mínimo es ${formatUsd(minimum)}.`
        if (value > 10000) return "El máximo es $10,000.00."
        return null
    }

    const selectPackage = (pkg: BillingPackage) => {
        setSelected(pkg.amount)
        setCustom("")
        setAmountError(null)
    }

    const onCustomChange = (value: string) => {
        setCustom(value)
        setSelected(null) // custom amount deselects packages
        setAmountError(null)
    }

    async function handleAddCredits() {
        const err = validate(effectiveAmount)
        if (err) {
            setAmountError(err)
            return
        }
        setIsSubmitting(true)
        try {
            const { checkoutUrl } = await billingService.createCheckout(effectiveAmount as number)
            window.location.href = checkoutUrl
        } catch (error) {
            if (error instanceof BillingNotConfiguredError) {
                toast.info("Recarga — próximamente", {
                    description: "El pago aún no está habilitado en el backend.",
                })
            } else if (error instanceof ApiError && error.status === 422) {
                setAmountError(error.message || "Monto no válido.")
            } else {
                toast.error("Failed to connect to payment. Try again.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const state = getBalanceState(amount)
    const balanceColor =
        state === "depleted"
            ? "text-red-600"
            : state === "low"
              ? "text-amber-600"
              : "text-slate-900"

    return (
        <div className="max-w-3xl space-y-6">
            {/* ── Balance + Recharge ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <Wallet className="h-4 w-4 text-[var(--color-brand-purple)]" />
                    Saldo disponible
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    {pending ? (
                        <span className="text-sm text-slate-400">
                            El backend de pagos aún no está disponible.
                        </span>
                    ) : balanceLoading && amount === null ? (
                        <div className="h-9 w-32 animate-pulse rounded bg-slate-100" />
                    ) : (
                        <>
                            <span className={`text-4xl font-black tabular-nums ${balanceColor}`}>
                                {formatUsd(amount)}
                            </span>
                            <span className="text-sm font-bold text-slate-400">{currency}</span>
                        </>
                    )}
                </div>

                {!pending && (
                    <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
                        <h3 className="text-sm font-bold text-slate-800">Recargar créditos</h3>

                        {/* Preset packages */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {(packages?.packages ?? []).map((pkg) => {
                                const active = selected === pkg.amount
                                return (
                                    <button
                                        key={pkg.amount}
                                        type="button"
                                        onClick={() => selectPackage(pkg)}
                                        className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${
                                            active
                                                ? "border-[var(--color-brand-purple)] bg-[var(--color-brand-purple)]/5"
                                                : "border-slate-200 hover:border-slate-300"
                                        }`}
                                    >
                                        <div
                                            className={`text-lg font-black ${active ? "text-[var(--color-brand-purple)]" : "text-slate-800"}`}
                                        >
                                            {pkg.label}
                                        </div>
                                        <div className="text-[11px] text-slate-400">{pkg.description}</div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Custom amount */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Monto personalizado
                            </label>
                            <div className="relative max-w-xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-400">
                                    $
                                </span>
                                <input
                                    type="number"
                                    min={minimum}
                                    step="1"
                                    value={custom}
                                    onChange={(e) => onCustomChange(e.target.value)}
                                    placeholder={`Custom amount (min ${formatUsd(minimum)})`}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-3 font-semibold text-slate-900 focus:border-[var(--color-brand-purple)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple)]/20"
                                />
                            </div>
                            {amountError && <p className="text-xs font-medium text-red-500">{amountError}</p>}
                        </div>

                        <button
                            onClick={handleAddCredits}
                            disabled={isSubmitting || effectiveAmount == null}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-brand-purple)] px-6 font-bold text-white transition-colors hover:bg-[#8b3ee0] disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Add Credits
                        </button>
                    </div>
                )}
            </div>

            {/* ── Transaction history ── */}
            {!pending && <TransactionHistory />}
        </div>
    )
}
