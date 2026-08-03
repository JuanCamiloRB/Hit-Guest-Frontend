"use client"

import { cn } from "@/lib/utils"
import type { ContractMode } from "../../types/contract-routing"

interface Props {
    value: ContractMode
    onChange: (mode: ContractMode) => void
    disabled?: boolean
}

/**
 * The all_sources / per_source switch (backend plan §1.1, §3.6). The two
 * modes are mutually exclusive at the backend — switching here doesn't write
 * anything by itself, it just changes what `ContractRoutingSection` renders
 * and what `planDocumentSync` will do on save.
 */
export function ContractModeToggle({ value, onChange, disabled }: Props) {
    return (
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
                type="button"
                disabled={disabled}
                aria-pressed={value === "all_sources"}
                onClick={() => onChange("all_sources")}
                className={cn(
                    "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    value === "all_sources"
                        ? "bg-white text-[var(--color-brand-purple)] shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                )}
            >
                Un contrato para todos los canales
            </button>
            <button
                type="button"
                disabled={disabled}
                aria-pressed={value === "per_source"}
                onClick={() => onChange("per_source")}
                className={cn(
                    "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    value === "per_source"
                        ? "bg-white text-[var(--color-brand-purple)] shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                )}
            >
                Un contrato distinto por canal
            </button>
        </div>
    )
}
