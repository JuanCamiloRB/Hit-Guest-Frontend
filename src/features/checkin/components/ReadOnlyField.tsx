"use client"

import { Lock } from "lucide-react"

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
            <label className="text-sm font-semibold text-slate-700">{label}</label>
            <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium flex items-center justify-between gap-2">
                <span className="truncate">{value || "—"}</span>
                <Lock size={14} className="text-slate-400 shrink-0" />
            </div>
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
    )
}
