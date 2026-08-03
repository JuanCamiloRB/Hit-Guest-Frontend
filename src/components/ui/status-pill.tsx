import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The single way HitGuest shows the state of something: a colored dot plus a
 * word. Replaces the per-screen pills that each picked their own hex.
 *
 * Two rules it enforces so the states stay readable:
 *  • State is carried by the dot AND the word, never by color alone — a
 *    colorblind PM distinguishes "Firmado" from "En proceso" by reading it.
 *  • Absence is not an object. `tone="none"` renders a bare dash in muted ink
 *    instead of a grey pill, so "no aplica" stops competing with real states.
 */
const statusPillVariants = cva(
    "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap",
    {
        variants: {
            tone: {
                success: "bg-success-sunk text-success",
                warning: "bg-warning-sunk text-warning",
                info: "bg-info-sunk text-info",
                idle: "bg-neutral-sunk text-ink-3",
                none: "text-ink-4 font-medium",
            },
        },
        defaultVariants: {
            tone: "idle",
        },
    },
)

export type StatusTone = NonNullable<VariantProps<typeof statusPillVariants>["tone"]>

interface StatusPillProps
    extends React.ComponentProps<"span">,
        VariantProps<typeof statusPillVariants> {
    /** Shown instead of the label when `tone="none"`. */
    emptyLabel?: string
}

function StatusPill({
    className,
    tone = "idle",
    children,
    emptyLabel = "—",
    ...props
}: StatusPillProps) {
    if (tone === "none") {
        return (
            <span
                data-slot="status-pill"
                data-tone="none"
                className={cn(statusPillVariants({ tone }), className)}
                {...props}
            >
                {emptyLabel}
            </span>
        )
    }

    return (
        <span
            data-slot="status-pill"
            data-tone={tone}
            className={cn(statusPillVariants({ tone }), className)}
            {...props}
        >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
            {children}
        </span>
    )
}

export { StatusPill, statusPillVariants }
