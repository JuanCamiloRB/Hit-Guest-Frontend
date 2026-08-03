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
    /** Renders the scheduled-time config (absolute time OR relative to an anchor). */
    isScheduled?: boolean
}

/**
 * Backend trigger key for the scheduled-time trigger. Must match the automation
 * parameter the backend already exposes ("at_time_of_day"); used as the key both
 * in triggerTypes and in triggerConfig so writes and reads never drift.
 */
const SCHEDULED_TRIGGER_KEY = "at_time_of_day"

const TRIGGER_TYPES: TriggerTypeDef[] = [
    { key: "on_checkin_completed", label: "Al completar el check-in" },
    { key: "on_guest_checkin_completed", label: "Al completar el registro de un huésped" },
    { key: "on_physical_checkout", label: "Al hacer check-out físico" },
    { key: SCHEDULED_TRIGGER_KEY, label: "A una hora programada", isScheduled: true },
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
            // Seed the documented defaults when enabling the scheduled trigger so
            // the payload is always complete (backend contract: all three fields).
            else if (key === SCHEDULED_TRIGGER_KEY && !cfg[key]) {
                cfg[key] = { time_of_day: "09:00:00", reference_date: "checkin_date", offset_days: 0 }
            }
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

    /** Set a field inside triggerConfig.at_time_of_day (mode/time/anchor/…). */
    const setScheduledField = (field: string, value: string | number | undefined) => {
        setParams((prev) => {
            const cfg = { ...((prev.triggerConfig as Record<string, any>) ?? {}) }
            const entry = { ...(cfg[SCHEDULED_TRIGGER_KEY] ?? {}) }
            if (value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value))) {
                delete entry[field]
            } else {
                entry[field] = value
            }
            cfg[SCHEDULED_TRIGGER_KEY] = entry
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

                            {checked && t.isScheduled && (
                                <ScheduledConfig config={triggerConfig[t.key] ?? {}} onChange={setScheduledField} />
                            )}

                            {checked && !t.isScheduled && (
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

/**
 * Config for the "A una hora programada" (at_time_of_day) trigger. Matches the
 * backend contract exactly:
 *   { time_of_day: "HH:MM:SS", reference_date: "checkin_date"|"checkout_date", offset_days: int }
 * Fires at `time_of_day` (property TZ) on `reference_date` shifted by `offset_days`
 * (negative = before, positive = after). E.g. checkout_date + (-1) = day before departure.
 */
function ScheduledConfig({
    config,
    onChange,
}: {
    config: Record<string, any>
    onChange: (field: string, value: string | number | undefined) => void
}) {
    const selectCls =
        "bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple)]/30"

    // Backend stores HH:MM:SS; the native time input works in HH:MM.
    const timeValue = ((config.time_of_day as string) ?? "").slice(0, 5)
    const referenceDate = (config.reference_date as string) ?? "checkin_date"

    return (
        <div className="mt-2 ml-6 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">A las</span>
                <input
                    type="time"
                    value={timeValue}
                    onChange={(e) =>
                        onChange("time_of_day", e.target.value ? `${e.target.value}:00` : undefined)
                    }
                    className={selectCls}
                />
                <span className="text-xs text-slate-500">del</span>
                <select
                    value={referenceDate}
                    onChange={(e) => onChange("reference_date", e.target.value)}
                    className={selectCls}
                >
                    <option value="checkin_date">día de llegada</option>
                    <option value="checkout_date">día de salida</option>
                </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Desplazar</span>
                <input
                    type="number"
                    value={config.offset_days ?? ""}
                    onChange={(e) =>
                        onChange("offset_days", e.target.value === "" ? undefined : parseInt(e.target.value, 10))
                    }
                    placeholder="0"
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-purple)]/30"
                />
                <span className="text-xs text-slate-500">días (− antes · + después)</span>
            </div>
        </div>
    )
}
