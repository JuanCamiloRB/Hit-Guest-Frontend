"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { IdentityCatalogState } from "../../hooks/useIdentityProviderCatalog"
import { IDENTITY_LEVEL_LABEL } from "../../lib/identity-providers"
import type { IdentityChoice } from "../../lib/identity-listing-override"

interface Props {
    value: IdentityChoice
    onChange: (choice: IdentityChoice) => void
    /** Descripción de «Heredar» con lo que tiene la propiedad. */
    inheritDescription: string
    /** La propiedad tiene el slot activo y con proveedor: solo así la unidad puede cambiar el nivel. */
    canOverrideLevel: boolean
    catalog: IdentityCatalogState & { retry: () => void }
    /** Error del backend en `provider_id`, tal cual. */
    error?: string | null
    disabled?: boolean
}

const OPTION_ORDER: IdentityChoice[] = ["inherit", "advanced", "essential", "disabled"]

const OPTION_COPY: Record<IdentityChoice, { label: string; description?: string }> = {
    inherit: { label: "Heredar" },
    advanced: {
        label: IDENTITY_LEVEL_LABEL.advanced,
        description: "Reconocimiento facial y del documento en tiempo real, aunque la propiedad use otra.",
    },
    essential: {
        label: IDENTITY_LEVEL_LABEL.essential,
        description: "El huésped sube fotos de su documento y la IA las valida, aunque la propiedad use otra.",
    },
    disabled: {
        label: "Desactivar",
        description: "Los huéspedes de esta unidad solo suben fotos del documento, sin verificación.",
    },
}

/**
 * Las cuatro opciones de identidad por unidad (contrato 2026-10-14). Solo
 * presentación: qué se envía lo decide `planIdentityOverrideWrite`.
 */
export function IdentityOverrideSelector({
    value,
    onChange,
    inheritDescription,
    canOverrideLevel,
    catalog,
    error,
    disabled,
}: Props) {
    const levelBlockedReason = (level: "advanced" | "essential"): string | null => {
        if (!canOverrideLevel) {
            return "La propiedad tiene esta verificación apagada: la unidad no puede encender un nivel por su cuenta."
        }
        if (catalog.status === "loading") return "Cargando proveedores…"
        if (!catalog.catalog[level]) return "Este nivel no está disponible en el catálogo de proveedores."
        return null
    }

    return (
        <fieldset className="space-y-2" aria-describedby={error ? "identity-override-error" : undefined}>
            <legend className="mb-1 text-sm font-semibold text-slate-700">Verificación en esta unidad</legend>

            {catalog.status === "error" && canOverrideLevel && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span>No pudimos cargar los proveedores. Avanzada y Esencial no se pueden elegir hasta reintentar.</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={catalog.retry}>
                        <RefreshCw size={12} aria-hidden /> Reintentar
                    </Button>
                </div>
            )}

            {OPTION_ORDER.map((choice) => {
                const blocked = choice === "advanced" || choice === "essential" ? levelBlockedReason(choice) : null
                // La opción vigente nunca se bloquea: el PM tiene que poder verla elegida.
                const isDisabled = disabled || (blocked != null && value !== choice)
                const checked = value === choice
                const description = choice === "inherit" ? inheritDescription : OPTION_COPY[choice].description
                return (
                    <label
                        key={choice}
                        className={cn(
                            "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                            isDisabled
                                ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70"
                                : checked
                                    ? "cursor-pointer border-brand-purple bg-brand-purple/5"
                                    : "cursor-pointer border-slate-200 hover:border-slate-300",
                        )}
                    >
                        <input
                            type="radio"
                            name="identity-override"
                            value={choice}
                            checked={checked}
                            disabled={isDisabled}
                            onChange={() => onChange(choice)}
                            className="mt-1 accent-[var(--color-brand-purple)]"
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900">{OPTION_COPY[choice].label}</span>
                            {description && <span className="block text-[13px] text-slate-600">{description}</span>}
                            {blocked && (
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                                    {catalog.status === "loading" && canOverrideLevel && <Loader2 size={11} className="animate-spin" aria-hidden />}
                                    {blocked}
                                </span>
                            )}
                        </span>
                    </label>
                )
            })}

            {error && (
                <p id="identity-override-error" role="alert" className="text-xs font-medium text-red-600">{error}</p>
            )}
        </fieldset>
    )
}
