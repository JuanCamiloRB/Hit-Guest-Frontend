"use client"

import { Lock } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Surface } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface ReadOnlyFieldProps {
    label: string
    value: string
    /** Optional helper text shown under the field. */
    hint?: string
}

/**
 * Presentational read-only field — displays a labelled value the guest cannot edit.
 * Used for identity-defining data on resume (document type/number), which must not
 * change mid-flow or it would create a conflicting guest record.
 */
export function ReadOnlyField({ label, value, hint }: ReadOnlyFieldProps) {
    return (
        <div className="space-y-1.5">
            <Label variant="plain" className="text-sm font-semibold text-ink-2">{label}</Label>
            <Surface tone="sunk" className="flex w-full items-center justify-between gap-2 px-4 py-3 font-medium text-ink-2">
                <span className="truncate">{value || "—"}</span>
                <Icon icon={Lock} size="sm" className="text-ink-3" />
            </Surface>
            {hint && <p className="text-xs text-ink-3">{hint}</p>}
        </div>
    )
}
