"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { SectionCard } from "@/components/ui/section-card"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingState } from "@/components/ui/loading-state"
import type { NodeUsage } from "@/features/billing/types"

/** Rows shown before the list is truncated — keeps the panel a fixed height. */
const MAX_ROWS = 8

interface Props {
    /** Nodes executed during `refMonth`, most-run first. */
    topNodes: NodeUsage[]
    refMonth: Date
    isLoading: boolean
}

/**
 * Ranking of the automations that ran most in the scoped month. Counts every
 * SUCCESSFUL run, billable or not (the check-in link and the PDF report execute
 * without charging), so this deliberately does not add up to the money figures —
 * the subtitle says so, because a PM would otherwise try to reconcile them.
 */
export function TopNodesPanel({ topNodes, refMonth, isLoading }: Props) {
    const rows = topNodes.slice(0, MAX_ROWS)
    const hidden = topNodes.length - rows.length
    const maxRuns = rows[0]?.runs ?? 0

    return (
        <SectionCard
            title="Nodos más ejecutados"
            description={`Ejecuciones exitosas en ${format(refMonth, "MMMM yyyy", {
                locale: es,
            })}, incluidas las no facturables`}
        >
            <div>
                {isLoading ? (
                    <LoadingState variant="spinner" className="h-56" label="Cargando ranking" />
                ) : rows.length === 0 ? (
                    <EmptyState
                        className="h-56 py-0"
                        title="Ninguna automatización se ejecutó este mes"
                        description="Prueba con otro mes en el selector."
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        {rows.map((node) => (
                            <div key={node.name} className="group">
                                <div className="flex items-baseline justify-between gap-3 pb-1">
                                    <span className="truncate text-sm font-semibold text-ink">
                                        {node.name}
                                    </span>
                                    <span className="shrink-0 text-xs font-bold tabular-nums text-ink-3">
                                        {node.runs}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-sunk">
                                    <div
                                        className="h-full rounded-full bg-[var(--color-brand-purple)]/70 transition-colors group-hover:bg-[var(--color-brand-purple)]"
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
        </SectionCard>
    )
}
