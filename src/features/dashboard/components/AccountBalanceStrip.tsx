"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Figure } from "@/components/ui/figure"
import { RechargeDialog } from "@/features/billing/components/RechargeDialog"
import type { AccountBalance } from "@/features/billing/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { Wallet } from "lucide-react"
import { formatUsdNumber, getBalanceState } from "@/features/billing/types"

interface Props {
    /** Último saldo conocido (el del store compartido); null = no disponible. */
    balance: AccountBalance | null
    isLoadingBalance: boolean
    /** La última consulta falló: con saldo, no se pudo actualizar; sin él, no hay. */
    balanceError?: boolean
    /** Vuelve a pedir el saldo — reintentar es trabajo del cliente, no del usuario con F5. */
    onRetryBalance?: () => void
}

/**
 * Nivel 1 del Tablero: la cuenta. Solo el saldo y la acción de recargar; el
 * selector de mes no lo gobierna. Es el mismo valor del header y del banner
 * (useBalanceStore). Sin saldo, «—», nunca 0.
 */
export function AccountBalanceStrip({ balance, isLoadingBalance, balanceError = false, onRetryBalance }: Props) {
    // El saldo es lo destacado de la cuenta: morado claro. Bajo o agotado, el
    // color del estado (como el chip del header). Sin saldo conocido, no se
    // tiñe de alarma: no se sabe.
    const state = balance ? getBalanceState(balance.amount) : null
    const tone = state === "depleted" ? "danger" : state === "low" ? "warning" : "accent"
    const figureTone = state === "depleted" ? "danger" : state === "low" ? "warning" : "ink"
    const badgeTone = state === "depleted" ? "danger" : state === "low" ? "warning" : "primary"
    return (
        <Surface as="section" flat tone={tone} data-balance-state={state ?? "unknown"} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" aria-labelledby="account-balance-title">
            <div className="flex min-w-0 items-center gap-4">
                <IconBadge icon={Wallet} tone={badgeTone} shape="square" size="md" />
                <div className="min-w-0">
                    <Heading level={2} size="subsection" tone="muted" id="account-balance-title">
                        Saldo disponible
                    </Heading>
                    {isLoadingBalance ? (
                        <Skeleton className="mt-2 h-7 w-36" />
                    ) : !balance ? (
                        <>
                            <Figure as="p" size="xl" tone="absent" className="mt-1">— USD</Figure>
                            <BalanceNotice text="Saldo no disponible" onRetry={onRetryBalance} />
                        </>
                    ) : (
                        <>
                            <p className="mt-1 flex items-baseline gap-1.5">
                                <Figure size="xl" tone={figureTone}>{formatUsdNumber(balance.amount)}</Figure>
                                <span className="text-sm font-medium text-ink-3">{balance.currency}</span>
                            </p>
                            {/* El mismo valor que el header: se conserva, pero se dice
                                que puede no ser el actual. */}
                            {balanceError && <BalanceNotice text="No se pudo actualizar" onRetry={onRetryBalance} />}
                        </>
                    )}
                </div>
            </div>
            <div className="shrink-0">
                <RechargeDialog />
            </div>
        </Surface>
    )
}

function BalanceNotice({ text, onRetry }: { text: string; onRetry?: () => void }) {
    return (
        <p className="mt-1 text-xs font-medium text-warning">
            {text}
            {onRetry && (
                <>
                    {" · "}
                    <Button variant="link-inherit" size="inline"
                        type="button"
                        onClick={onRetry}
                    >
                        Reintentar
                    </Button>
                </>
            )}
        </p>
    )
}
