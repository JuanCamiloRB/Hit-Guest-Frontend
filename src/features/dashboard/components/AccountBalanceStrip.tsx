"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { RechargeDialog } from "@/features/billing/components/RechargeDialog"
import type { AccountBalance } from "@/features/billing/types"
import { cn } from "@/lib/utils"
import { DASHBOARD_SURFACE } from "./dashboard-surface"

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
        <section
            aria-labelledby="account-balance-title"
            className={cn(
                DASHBOARD_SURFACE,
                "flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6",
            )}
        >
            <div className="min-w-0">
                <h2 id="account-balance-title" className="font-secondary text-sm font-medium tracking-normal text-ink-3">
                    Saldo disponible
                </h2>
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
        </section>
    )
}

function BalanceNotice({ text, onRetry }: { text: string; onRetry?: () => void }) {
    return (
        <p className="mt-1 text-xs font-medium text-warning">
            {text}
            {onRetry && (
                <>
                    {" · "}
                    <button
                        type="button"
                        onClick={onRetry}
                        className="font-semibold underline underline-offset-2 hover:opacity-80"
                    >
                        Reintentar
                    </button>
                </>
            )}
        </p>
    )
}
