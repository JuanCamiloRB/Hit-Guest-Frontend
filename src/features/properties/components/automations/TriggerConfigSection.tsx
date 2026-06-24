"use client"

import { Zap } from "lucide-react"

/**
 * Universal trigger configuration shared by every automation (per the providers
 * reference). Stored inside `parameters` alongside the provider-specific config:
 *   - triggerTypes:  when the automation fires
 *   - triggerConfig: per-trigger options (delay_minutes, predecessor id)
 *   - guest_filter:  which guests it applies to
 *
 * All optional — if the PM leaves it untouched the backend applies its defaults.
 */

interface TriggerTypeDef {
    key: string
    label: string
    hasPredecessor?: boolean
}

const TRIGGER_TYPES: TriggerTypeDef[] = [
    { key: "on_checkin_completed", label: "Al completar el check-in" },
    { key: "on_guest_checkin_completed", label: "Al completar el registro de un huésped" },
    { key: "on_physical_checkout", label: "Al hacer check-out físico" },
    { key: "after_automation", label: "Después de otra automatización", hasPredecessor: true },
]

const GUEST_FILTERS = [
    { value: "all", label: "Todos los huéspedes" },
    { value: "foreign_only", label: "Solo extranjeros" },
    { value: "national_only", label: "Solo nacionales" },
]

interface Props {
    params: Record<string, unknown>
    setParams: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void
}

export function TriggerConfigSection({ params, setParams }: Props) {
    const triggerTypes = Array.isArray(params.triggerTypes) ? (params.triggerTypes as string[]) : []
    const triggerConfig = (params.triggerConfig as Record<string, any>) ?? {}
    const guestFilter = (params.guest_filter as string) ?? ""

    const toggleTrigger = (key: string) => {
        setParams((prev) => {
            const current = Array.isArray(prev.triggerTypes) ? (prev.triggerTypes as string[]) : []
            const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
            // Drop config for de-selected triggers so we don't send orphaned entries.
            const cfg = { ...((prev.triggerConfig as Record<string, any>) ?? {}) }
            if (!next.includes(key)) delete cfg[key]
            return { ...prev, triggerTypes: next, triggerConfig: cfg }
        })
    }

    const setTriggerConfigValue = (key: string, field: string, value: number | undefined) => {
        setParams((prev) => {
            const cfg = { ...((prev.triggerConfig as Record<string, any>) ?? {}) }
            const entry = { ...(cfg[key] ?? {}) }
            if (value === undefined || Number.isNaN(value)) delete entry[field]
            else entry[field] = value
            cfg[key] = entry
            return { ...prev, triggerConfig: cfg }
        })
    }

    const setGuestFilter = (value: string) => {
        setParams((prev) => ({ ...prev, guest_filter: value }))
    }

    return (
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
                <Zap size={15} className="text-[var(--color-brand-purple)]" />
                <h4 className="text-sm font-bold text-slate-800">Disparador</h4>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Opcional</span>
            </div>
            <p className="text-xs text-slate-500 -mt-1">Define cuándo se ejecuta esta automatización y a qué huéspedes aplica.</p>

            {/* Trigger types */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">¿Cuándo se ejecuta?</label>
                {TRIGGER_TYPES.map((t) => {
                    const checked = triggerTypes.includes(t.key)
                    return (
                        <div key={t.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleTrigger(t.key)}
                                    className="h-4 w-4 rounded border-slate-300 text-[var(--color-brand-purple)] focus:ring-[var(--color-brand-purple)]/30"
                                />
                                <span className="text-sm text-slate-700">{t.label}</span>
                            </label>

                            {checked && (
                                <div className="mt-2 ml-6 flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-500">Espera</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={triggerConfig[t.key]?.delay_minutes ?? ""}
                                            onChange={(e) =>
                                                setTriggerConfigValue(t.key, "delay_minutes", e.target.value === "" ? undefined : Number(e.target.value))
                                            }
                                            placeholder="0"
                                            className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple)]/30"
                                        />
                                        <span className="text-xs text-slate-500">min</span>
                                    </div>
                                    {t.hasPredecessor && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-slate-500">Tras automatización #</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={triggerConfig[t.key]?.predecessor_automation_id ?? ""}
                                                onChange={(e) =>
                                                    setTriggerConfigValue(t.key, "predecessor_automation_id", e.target.value === "" ? undefined : Number(e.target.value))
                                                }
                                                placeholder="ID"
                                                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple)]/30"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Guest filter */}
            <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-600">¿A qué huéspedes aplica?</label>
                <div className="flex flex-wrap gap-2">
                    {GUEST_FILTERS.map((g) => {
                        const active = guestFilter === g.value
                        return (
                            <button
                                key={g.value}
                                type="button"
                                onClick={() => setGuestFilter(g.value)}
                                className={
                                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                                    (active
                                        ? "border-[var(--color-brand-purple)] bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)]"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                                }
                            >
                                {g.label}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
