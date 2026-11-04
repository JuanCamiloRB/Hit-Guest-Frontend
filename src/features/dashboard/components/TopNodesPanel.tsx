"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { EmptyState } from "@/components/ui/empty-state"
import type { NodeUsage } from "@/features/billing/types"
import { AnalysisHeading } from "./AnalysisHeading"

/** Rows shown before the list is truncated — keeps the panel a fixed height. */
const MAX_ROWS = 8

interface Props {
    /** Nodes executed during `refMonth`, most-run first. */
    topNodes: NodeUsage[]
    refMonth: Date
}

/**
 * Ranking of the automations that ran most in the scoped month. Counts every
 * SUCCESSFUL run, billable or not (the check-in link and the PDF report execute
 * without charging), so this deliberately does not add up to the money figures —
 * the subtitle says so, because a PM would otherwise try to reconcile them.
 *
 * Columna del análisis del periodo (nivel 2). El nombre de cada nodo es el que
 * manda el backend, sin mapeos. Barras en neutro: el color de marca queda para
 * la selección y las acciones.
 */
export function TopNodesPanel({ topNodes, refMonth }: Props) {
    const rows = topNodes.slice(0, MAX_ROWS)
    const hidden = topNodes.length - rows.length
    const maxRuns = rows[0]?.runs ?? 0

    return (
        <div>
            <AnalysisHeading
                title="Nodos ejecutados"
                description={`Ejecuciones exitosas de reservas con check-in en ${format(refMonth, "MMMM 'de' yyyy", {
                    locale: es,
                })}, incluidas las no facturables`}
            />
            <div className="mt-4">
                {rows.length === 0 ? (
                    <EmptyState className="h-48 py-0" title="Ninguna automatización se ejecutó este mes" />
                ) : (
                    <div className="flex flex-col gap-3">
                        {rows.map((node) => (
                            <div key={node.name} className="group">
                                <div className="flex items-baseline justify-between gap-3 pb-1">
                                    <span className="truncate text-sm font-medium text-ink">
                                        {node.name}
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-2">
                                        {node.runs}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-sunk">
                                    <div
                                        className="h-full rounded-full bg-ink-4/70 transition-colors group-hover:bg-ink-3"
                                        style={{ width: `max(${(node.runs / maxRuns) * 100}%, 2px)` }}
                                    />
                                </div>
                            </div>
                        ))}

                        {hidden > 0 && (
                            <p className="pt-1 text-xs text-ink-4">
                                +{hidden} {hidden === 1 ? "nodo más" : "nodos más"}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
