import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface SectionCardProps extends React.ComponentProps<"div"> {
    title: string
    description?: string
    /** Filters, search or buttons scoped to this section. */
    actions?: React.ReactNode
    /** Set when the body owns its own padding (a table, a full-bleed chart). */
    flush?: boolean
}

/**
 * The panel wrapper for a titled section — list, table or chart.
 *
 * Replaces four hand-copied headers that each rebuilt the same thing with a
 * purple-to-blue gradient strip and a colored icon chip. That treatment was
 * decoration: it spent color on the container instead of on the data, and
 * repeated identically on every panel so it ranked nothing. Here the title
 * carries the hierarchy and the surface stays quiet.
 */
function SectionCard({
    title,
    description,
    actions,
    flush = false,
    className,
    children,
    ...props
}: SectionCardProps) {
    return (
        <Card
            data-slot="section-card"
            className={cn("overflow-hidden border-rule p-0 shadow-sm", className)}
            {...props}
        >
            <div className="flex flex-col gap-3 border-b border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-ink">{title}</h3>
                    {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>

            <div className={cn(!flush && "p-5")}>{children}</div>
        </Card>
    )
}

export { SectionCard }
