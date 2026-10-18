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
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Cómo aplicar los contratos">
            <button
                type="button"
                disabled={disabled}
                role="radio"
                aria-checked={value === "all_sources"}
                onClick={() => onChange("all_sources")}
                className={cn(
                    "rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    value === "all_sources"
                        ? "border-[var(--color-brand-purple)] bg-[var(--color-brand-purple)]/5 ring-1 ring-[var(--color-brand-purple)]/20"
                        : "border-slate-200 bg-white hover:border-slate-300",
                )}
            >
                <span className={cn("block text-sm font-bold", value === "all_sources" ? "text-[var(--color-brand-purple)]" : "text-slate-800")}>
                    Un mismo contrato para todos
                </span>
                <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">
                    Todos los huéspedes firman el mismo documento, sin importar de dónde llegue la reserva.
                </span>
            </button>
            <button
                type="button"
                disabled={disabled}
                role="radio"
                aria-checked={value === "per_source"}
                onClick={() => onChange("per_source")}
                className={cn(
                    "rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    value === "per_source"
                        ? "border-[var(--color-brand-purple)] bg-[var(--color-brand-purple)]/5 ring-1 ring-[var(--color-brand-purple)]/20"
                        : "border-slate-200 bg-white hover:border-slate-300",
                )}
            >
                <span className={cn("block text-sm font-bold", value === "per_source" ? "text-[var(--color-brand-purple)]" : "text-slate-800")}>
                    Un contrato para cada canal
                </span>
                <span className="mt-1 block text-xs font-medium leading-relaxed text-slate-500">
                    Configura por separado Airbnb, Booking.com, reservas directas y los demás canales.
                </span>
            </button>
        </div>
    )
}
