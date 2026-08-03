import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface LoadingStateProps extends React.ComponentProps<"div"> {
    /**
     * `rows` mimics the shape of the list that's coming, so nothing jumps when
     * the data lands. `spinner` is for small inline waits where there is no
     * shape to announce ahead of time — a button or a compact panel.
     */
    variant?: "rows" | "spinner"
    /** Row count for `rows`. Match the page size you usually render. */
    rows?: number
    /** Announced to screen readers while the wait lasts. */
    label?: string
}

/**
 * The shared waiting state. Replaces the spinner-in-a-box copy-pasted across
 * dozens of screens: a centered spinner tells you nothing about what's coming
 * and lets the layout jump when it arrives, so lists wait with row-shaped
 * skeletons instead.
 */
function LoadingState({
    variant = "rows",
    rows = 5,
    label = "Cargando…",
    className,
    ...props
}: LoadingStateProps) {
    if (variant === "spinner") {
        return (
            <div
                data-slot="loading-state"
                role="status"
                aria-label={label}
                className={cn("flex items-center justify-center py-10", className)}
                {...props}
            >
                <Loader2 className="size-5 animate-spin text-ink-4" />
                <span className="sr-only">{label}</span>
            </div>
        )
    }

    return (
        <div
            data-slot="loading-state"
            role="status"
            aria-label={label}
            className={cn("flex flex-col gap-3 p-4", className)}
            {...props}
        >
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-1/5" />
                    </div>
                    <Skeleton className="h-6 w-20 shrink-0" />
                </div>
            ))}
            <span className="sr-only">{label}</span>
        </div>
    )
}

export { LoadingState }
