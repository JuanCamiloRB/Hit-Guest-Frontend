"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { RechargeDialog } from "@/features/billing/components/RechargeDialog"
import type { AccountBalance } from "@/features/billing/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Surface } from "@/components/ui/card"

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
    return (
        <Surface as="section" flat className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" aria-labelledby="account-balance-title">
            <div className="min-w-0">
                <Heading level={2} size="subsection" tone="muted" id="account-balance-title">
                    Saldo disponible
                </Heading>
                {isLoadingBalance ? (
                    <Skeleton className="mt-2 h-7 w-36" />
                ) : !balance ? (
                    <>
                        <p className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-ink-4">— USD</p>
                        <BalanceNotice text="Saldo no disponible" onRetry={onRetryBalance} />
                    </>
                ) : (
                    <>
                        <p className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-3xl font-semibold leading-tight tracking-tight tabular-nums text-ink">
                                {balance.amount.toLocaleString("es-CO", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                            <span className="text-sm font-medium text-ink-3">{balance.currency}</span>
                        </p>
                        {/* El mismo valor que el header: se conserva, pero se dice
                            que puede no ser el actual. */}
                        {balanceError && <BalanceNotice text="No se pudo actualizar" onRetry={onRetryBalance} />}
                    </>
                )}
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
