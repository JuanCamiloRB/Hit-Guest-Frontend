"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Wallet, Plus } from "lucide-react"
import { Icon } from "@/components/ui/icon"
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
import { Button } from "@/components/ui/button"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/hooks/useTranslation"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FieldError } from "@/components/ui/form"

/** Balance card + recharge (packages/custom) + transaction history. */
export function BillingSettings() {
    const { t } = useTranslation()
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
                toast.error(t("billing.checkoutError"))
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
            <Surface flat className="p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-3">
                    <Icon icon={Wallet} className="text-primary" />
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
                        <Skeleton className="h-10 w-32" />
                    ) : amount === null ? (
                        // Sin saldo conocido se dice; «0,00 USD» en rojo sería un dato inventado.
                        <div>
                            <span className="text-4xl font-bold tabular-nums text-ink-3">— USD</span>
                            <p className="mt-1 text-xs font-medium text-warning">
                                Saldo no disponible ·{" "}
                                <Button variant="link-inherit" size="inline" type="button" onClick={() => void refresh()}>
                                    Reintentar
                                </Button>
                            </p>
                        </div>
                    ) : (
                        <div>
                            <span className={`text-4xl font-bold tabular-nums ${balanceColor}`}>
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
                        <Heading level={3} size="subsection">Recargar créditos</Heading>

                        {/* Preset packages */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {(packages?.packages ?? []).map((pkg) => {
                                const active = selected === pkg.amount
                                return (
                                    <UnstyledButton
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
                                            className={`text-lg font-bold ${active ? "text-primary" : "text-ink"}`}
                                        >
                                            {pkg.label}
                                        </div>
                                        <div className="text-xs text-ink-3">{pkg.description}</div>
                                    </UnstyledButton>
                                )
                            })}
                        </div>

                        {/* Custom amount */}
                        <div className="space-y-1.5">
                            <Label variant="plain" className="text-xs font-semibold text-ink-3">
                                Monto personalizado
                            </Label>
                            <div className="relative max-w-xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-ink-3">
                                    $
                                </span>
                                <Input
                                    type="number"
                                    min={minimum}
                                    step="1"
                                    value={custom}
                                    onChange={(e) => onCustomChange(e.target.value)}
                                    placeholder={t("billing.customAmountPlaceholder", { min: formatUsd(minimum) })}
                                    className="w-full py-2.5 pl-7 pr-3 font-semibold text-ink"
                                />
                            </div>
                            {amountError && <FieldError>{amountError}</FieldError>}
                        </div>

                        <Button type="button" size="lg" onClick={handleAddCredits} disabled={effectiveAmount == null} className="inline-flex items-center" loading={isSubmitting}>
                            <Icon icon={Plus} />
                            {t("billing.addCredits")}
                        </Button>
                    </div>
                )}
            </Surface>

            {/* ── Transaction history ── */}
            {!pending && <TransactionHistory />}
        </div>
    )
}
