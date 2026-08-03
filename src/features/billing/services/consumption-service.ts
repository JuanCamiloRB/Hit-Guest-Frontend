/**
 * Consumption service — turns raw automation usage records into per-reservation
 * cost breakdowns and aggregate KPIs for the Operations Dashboard.
 *
 * Source of truth: GET /reservations/{uuid}/automation-records (real billed
 * records with `unitCost` + `billable`). We fetch them per reservation in
 * parallel, the same pattern the reservations list already uses for status.
 */

import { automationService } from "@/features/properties/services/automation-service"
import { isSameMonth, startOfMonth, subMonths } from "date-fns"
import type { Reservation } from "@/types"
import type {
    CostCategory,
    CostLineItem,
    ReservationCost,
    ConsumptionAnalytics,
    ConsumptionSummary,
    MonthlyPoint,
    NodeUsage,
} from "../types"
import { COST_CATEGORIES, classifyRecord } from "../lib/pricing"

/**
 * A usage record as it arrives from the API. Typed as an open record because the
 * backend may use camelCase or snake_case keys; the readers below normalize it.
 */
type RawUsageRecord = Record<string, unknown>

/** Read unitCost from a raw record, tolerating camelCase / snake_case. */
function readUnitCost(rec: RawUsageRecord): number {
    const raw = rec.unitCost ?? rec.unit_cost
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"))
    return Number.isFinite(n) ? n : 0
}

function readBillable(rec: RawUsageRecord): boolean {
    return Boolean(rec.billable ?? rec.is_billable ?? false)
}

/**
 * Only successful runs are charged. A retry that failed still produces a record,
 * so counting every billable record inflates the total (e.g. 3 verification
 * attempts × 0.85 = 2.55 for a single guest). We bill exclusively `completed`
 * records, tolerating camelCase/snake_case and a boolean `wasSuccessful` flag.
 */
function isSuccessful(rec: RawUsageRecord): boolean {
    const status = String(rec.status ?? "").toLowerCase()
    if (status) return status === "completed" || status === "success" || status === "successful"
    return Boolean(rec.wasSuccessful ?? rec.was_successful ?? false)
}

function readSlug(rec: RawUsageRecord): string | null {
    return (rec.providerSlug ?? rec.provider_slug ?? null) as string | null
}

function readName(rec: RawUsageRecord): string | null {
    return (rec.automationName ?? rec.automation_name ?? null) as string | null
}

/** Build the always-present 5 line items, zeroed out. */
function emptyLineItems(): Record<CostCategory, CostLineItem> {
    const map = {} as Record<CostCategory, CostLineItem>
    for (const { key, label } of COST_CATEGORIES) {
        map[key] = { category: key, label, amount: 0, count: 0, consumed: false }
    }
    return map
}

/** Aggregate a reservation's raw usage records into a cost breakdown. */
function aggregate(reservation: Reservation, records: RawUsageRecord[]): ReservationCost {
    const items = emptyLineItems()
    // Node tally is broader than the cost lines: the "most executed nodes" panel
    // counts every successful run, including the non-billable ones.
    const runsByNode = new Map<string, number>()

    for (const rec of records) {
        // Charge only successful runs — skip pending/failed retries so a guest with
        // several verification attempts isn't billed for each one.
        if (!isSuccessful(rec)) continue

        const nodeName = readName(rec) || readSlug(rec)
        if (nodeName) runsByNode.set(nodeName, (runsByNode.get(nodeName) ?? 0) + 1)

        if (!readBillable(rec)) continue
        const category = classifyRecord(readSlug(rec), readName(rec))
        if (!category) continue
        const line = items[category]
        line.amount += readUnitCost(rec)
        line.count += 1
        line.consumed = true
    }

    const lineItems = COST_CATEGORIES.map(({ key }) => items[key])
    const total = lineItems.reduce((sum, l) => sum + l.amount, 0)

    return {
        reservationId: reservation.id,
        guestName: reservation.guestName,
        unitName: reservation.unitName,
        propertyName: reservation.propertyName,
        checkIn: reservation.checkIn,
        lineItems,
        total,
        nodeRuns: [...runsByNode].map(([name, runs]) => ({ name, runs })),
    }
}

/** Successful identity-verification charges on a reservation (one per guest). */
function verifiedGuestCount(cost: ReservationCost): number {
    return cost.lineItems.find((l) => l.category === "checkin")?.count ?? 0
}

/** Months of history the consumption chart shows, including the current one. */
export const HISTORY_MONTHS = 6

class ConsumptionService {
    /**
     * Per-reservation cost breakdown for the given reservations. Fetches usage
     * records for each in parallel; a reservation whose records fail to load
     * simply shows a zeroed breakdown rather than breaking the whole table.
     */
    async getReservationCosts(reservations: Reservation[]): Promise<ReservationCost[]> {
        const results = await Promise.allSettled(
            reservations.map((r) => automationService.listUsageRecords(r.id)),
        )

        return reservations.map((reservation, i) => {
            const result = results[i]
            // Records enter as the typed AutomationUsageRecord[], but may carry
            // snake_case keys the readers normalize — treat as raw at this boundary.
            const records = (
                result.status === "fulfilled" ? result.value : []
            ) as unknown as RawUsageRecord[]
            return aggregate(reservation, records)
        })
    }

    /**
     * Roll per-reservation costs up into everything the Tablero shows for the
     * month of `refDate`: the KPIs (with the month-over-month delta), the
     * six-month consumption history and the node execution ranking.
     *
     * Reservations are bucketed by check-in date, the same date the rest of the
     * dashboard uses to say a reservation "happened" in a given month.
     */
    analyze(costs: ReservationCost[], refDate: Date = new Date()): ConsumptionAnalytics {
        const prevDate = subMonths(refDate, 1)

        // Six empty buckets ending at the reference month, oldest first.
        const monthly: MonthlyPoint[] = Array.from({ length: HISTORY_MONTHS }, (_, i) => ({
            date: startOfMonth(subMonths(refDate, HISTORY_MONTHS - 1 - i)),
            total: 0,
        }))
        const runsByNode = new Map<string, number>()

        let monthTotal = 0
        let prevMonthTotal = 0
        let grandTotal = 0
        let billedReservations = 0
        let verifiedGuests = 0

        for (const c of costs) {
            grandTotal += c.total

            const bucket = monthly.find((m) => isSameMonth(m.date, c.checkIn))
            if (bucket) bucket.total += c.total

            if (isSameMonth(c.checkIn, prevDate)) prevMonthTotal += c.total
            if (!isSameMonth(c.checkIn, refDate)) continue

            monthTotal += c.total
            if (c.total > 0) billedReservations += 1
            verifiedGuests += verifiedGuestCount(c)
            for (const node of c.nodeRuns) {
                runsByNode.set(node.name, (runsByNode.get(node.name) ?? 0) + node.runs)
            }
        }

        const topNodes: NodeUsage[] = [...runsByNode]
            .map(([name, runs]) => ({ name, runs }))
            .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))

        const summary: ConsumptionSummary = {
            monthTotal,
            prevMonthTotal,
            // No baseline (first month of activity) → no percentage to show.
            monthDeltaPct: prevMonthTotal > 0 ? (monthTotal - prevMonthTotal) / prevMonthTotal : null,
            billedReservations,
            avgPerReservation: billedReservations > 0 ? monthTotal / billedReservations : 0,
            verifiedGuests,
            grandTotal,
        }

        return { summary, monthly, topNodes }
    }
}

export const consumptionService = new ConsumptionService()
