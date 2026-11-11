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
    const { amount, isLoading: balanceLoading, loaded: balanceLoaded, pending, error: balanceError, refresh } = useBalanceStore()

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
            ? "text-danger"
            : state === "low"
              ? "text-warning"
              : "text-ink"

    return (
        <div className="max-w-3xl space-y-6">
            {/* ── Balance + Recharge ── */}
            <div className="rounded-2xl border border-rule bg-white p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-3">
                    <Wallet className="h-4 w-4 text-primary" />
                    Saldo disponible
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    {pending ? (
                        <span className="text-sm text-ink-3">
                            El backend de pagos aún no está disponible.
                        </span>
                    ) : amount === null && (balanceLoading || !balanceLoaded) ? (
                        // También antes de la primera consulta: sin esto el primer
                        // render decía «no disponible» un instante.
                        <div className="h-10 w-32 animate-pulse rounded bg-sunk" />
                    ) : amount === null ? (
                        // Sin saldo conocido se dice; «0,00 USD» en rojo sería un dato inventado.
                        <div>
                            <span className="text-4xl font-black tabular-nums text-ink-3">— USD</span>
                            <p className="mt-1 text-xs font-medium text-warning">
                                Saldo no disponible ·{" "}
                                <button type="button" onClick={() => void refresh()} className="font-semibold underline underline-offset-2">
                                    Reintentar
                                </button>
                            </p>
                        </div>
                    ) : (
                        <div>
                            <span className={`text-4xl font-black tabular-nums ${balanceColor}`}>
                                {formatUsd(amount)}
                            </span>
                            {balanceError && (
                                <p className="mt-1 text-xs font-medium text-warning">No se pudo actualizar el saldo</p>
                            )}
                        </div>
                    )}
                </div>

                {!pending && (
                    <div className="mt-6 space-y-4 border-t border-rule pt-5">
                        <h3 className="text-sm font-bold text-ink">Recargar créditos</h3>

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
                                                ? "border-primary bg-primary/5"
                                                : "border-rule hover:border-input-hover"
                                        }`}
                                    >
                                        <div
                                            className={`text-lg font-black ${active ? "text-primary" : "text-ink"}`}
                                        >
                                            {pkg.label}
                                        </div>
                                        <div className="text-xs text-ink-3">{pkg.description}</div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Custom amount */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                                Monto personalizado
                            </label>
                            <div className="relative max-w-xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-ink-3">
                                    $
                                </span>
                                <input
                                    type="number"
                                    min={minimum}
                                    step="1"
                                    value={custom}
                                    onChange={(e) => onCustomChange(e.target.value)}
                                    placeholder={`Custom amount (min ${formatUsd(minimum)})`}
                                    className="w-full rounded-xl border border-rule bg-sunk/50 py-2.5 pl-7 pr-3 font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            {amountError && <p className="text-xs font-medium text-danger">{amountError}</p>}
                        </div>

                        <button
                            onClick={handleAddCredits}
                            disabled={isSubmitting || effectiveAmount == null}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 font-bold text-white transition-colors hover:bg-primary disabled:opacity-50"
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
