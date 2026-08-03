import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.ComponentProps<"div"> {
    /** What is missing, in the user's words. */
    title: string
    /** Why it's empty or what to do about it. Optional — omit when obvious. */
    description?: string
    icon?: React.ReactNode
    /** The action that fills the emptiness, when there is one. */
    action?: React.ReactNode
}

/**
 * The empty state for lists and panels. Replaces a dozen hand-written grey
 * paragraphs that each chose their own size and centering.
 *
 * An empty list is a moment to orient someone, not an error: say what would go
 * here and, when it exists, give the action that creates the first one.
 */
function EmptyState({
    title,
    description,
    icon,
    action,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            data-slot="empty-state"
            className={cn(
                "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
                className,
            )}
            {...props}
        >
            {icon && <div className="mb-1 text-ink-4">{icon}</div>}
            <p className="text-sm font-semibold text-ink">{title}</p>
            {description && <p className="max-w-sm text-xs text-ink-3">{description}</p>}
            {action && <div className="mt-3">{action}</div>}
        </div>
    )
}

export { EmptyState }
