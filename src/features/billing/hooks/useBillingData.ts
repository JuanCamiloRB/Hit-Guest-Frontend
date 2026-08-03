"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { startOfMonth } from "date-fns"
import { reservationsService } from "@/features/reservations/services/reservations-service"
import { billingService } from "../services/billing-service"
import { consumptionService } from "../services/consumption-service"
import type {
    AccountBalance,
    ConsumptionSummary,
    MonthlyPoint,
    NodeUsage,
    ReservationCost,
} from "../types"

interface BillingData {
    balance: AccountBalance | null
    /** True while the balance endpoint is unavailable (backend pending). */
    balancePending: boolean
    costs: ReservationCost[]
    /** KPIs for `refMonth`; null until the costs finish loading. */
    summary: ConsumptionSummary | null
    /** Six months ending at `refMonth`, oldest first. */
    monthly: MonthlyPoint[]
    /** Nodes executed during `refMonth`, most-run first. */
    topNodes: NodeUsage[]
    /** First day of the month the month-scoped panels are showing. */
    refMonth: Date
    setRefMonth: (month: Date) => void
    isLoadingCosts: boolean
    isLoadingBalance: boolean
    refetchBalance: () => void
}

/**
 * Loads everything the billing Tablero needs:
 *  • account balance (independent, may be backend-pending → null)
 *  • per-reservation cost breakdowns (from real usage records)
 *
 * Reservations are fetched once here and reused for the costs, so the KPI cards
 * and the breakdown table share a single network pass. The month-scoped KPIs,
 * history and node ranking are derived from `costs` by `consumptionService.analyze`
 * — no extra request, and they stay in sync with the breakdown table by construction.
 */
export function useBillingData(): BillingData {
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [balancePending, setBalancePending] = useState(false)
    const [isLoadingBalance, setIsLoadingBalance] = useState(true)

    const [costs, setCosts] = useState<ReservationCost[]>([])
    const [isLoadingCosts, setIsLoadingCosts] = useState(true)

    // Normalized to the 1st so the month-selector arrows can't drift the day and
    // land on a shorter month (Jan 31 → Feb 31).
    const [refMonth, setRefMonthState] = useState(() => startOfMonth(new Date()))
    const setRefMonth = useCallback((month: Date) => setRefMonthState(startOfMonth(month)), [])

    const loadBalance = useCallback(() => {
        setIsLoadingBalance(true)
        billingService
            .getBalance()
            .then((b) => {
                setBalance(b)
                setBalancePending(b === null)
            })
            .catch(() => {
                setBalance(null)
                setBalancePending(true)
            })
            .finally(() => setIsLoadingBalance(false))
    }, [])

    useEffect(() => {
        let mounted = true
        loadBalance()

        setIsLoadingCosts(true)
        reservationsService
            .list()
            .then((reservations) => consumptionService.getReservationCosts(reservations))
            .then((c) => {
                if (!mounted) return
                setCosts(c)
            })
            .catch(() => {
                if (!mounted) return
                setCosts([])
            })
            .finally(() => {
                if (mounted) setIsLoadingCosts(false)
            })

        return () => {
            mounted = false
        }
    }, [loadBalance])

    // Derived, not fetched: changing the month re-slices the same `costs` with no
    // extra request, so the KPIs, history and node ranking can never disagree
    // with the breakdown table below them.
    const analytics = useMemo(
        () => consumptionService.analyze(costs, refMonth),
        [costs, refMonth],
    )

    return {
        balance,
        balancePending,
        costs,
        // Hold the month-scoped panels back until the costs are in, so they show
        // their spinner instead of real-looking zeros built from an empty list.
        summary: isLoadingCosts ? null : analytics.summary,
        monthly: analytics.monthly,
        topNodes: analytics.topNodes,
        refMonth,
        setRefMonth,
        isLoadingCosts,
        isLoadingBalance,
        refetchBalance: loadBalance,
    }
}
