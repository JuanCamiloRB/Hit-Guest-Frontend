"use client"

import { Zap } from "lucide-react"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Universal trigger configuration shared by every automation (per the providers
 * reference). Stored inside `parameters` alongside the provider-specific config:
 *   - triggerTypes:  when the automation fires
 *   - triggerConfig: per-trigger options (delay_minutes, predecessor id)
 *   - guest_filter:  which guests it applies to
 *
 * Para automations operativas `triggerTypes` debe tener al menos un valor: sin
 * coincidencia el despachador la omite en silencio. `triggerConfig` solo se
 * exige para los triggers que declaran opciones; `guest_filter` es opcional
 * salvo SIRE, donde el frontend fuerza `foreign_only`.
 */

interface TriggerTypeDef {
    key: string
    label: string
    /** Only these triggers accept triggerConfig.{trigger}.delay_minutes. */
    hasDelay?: boolean
    /** Valid in the API but not configurable until it exposes a public predecessor id. */
    needsInternalPredecessorId?: boolean
    /** Renders the scheduled-time config (absolute time OR relative to an anchor). */
    isScheduled?: boolean
}

/**
 * Backend trigger key for the scheduled-time trigger. Must match the automation
 * parameter the backend already exposes ("at_time_of_day"); used as the key both
 * in triggerTypes and in triggerConfig so writes and reads never drift.
 */
const SCHEDULED_TRIGGER_KEY = "at_time_of_day"

/**
 * Los SEIS disparadores que el backend emite de verdad. Desde agosto de 2026 los
 * valida: un string fuera de esta lista responde 422 en
 * `parameters.triggerTypes.{índice}`.
 *
 * `on_physical_checkin`, `after_checkin` y `after_checkout` fueron ELIMINADOS —
 * tenían rama en el despachador pero ningún emisor, así que una automation
 * configurada con ellos no corría nunca, en silencio. Hoy dan 422. No volver a
 * agregarlos: `at_time_of_day` con `reference_date` + `offset_days` y
 * `on_physical_checkout` con `delay_minutes` ya cubren esos casos.
 */
const TRIGGER_TYPES: TriggerTypeDef[] = [
    { key: "on_main_guest_checkin_completed", label: "Al completar el check-in del huésped principal" },
    { key: "on_checkin_completed", label: "Al completar el check-in" },
    { key: "on_guest_checkin_completed", label: "Al completar el registro de un huésped" },
    { key: "on_physical_checkout", label: "Al hacer check-out físico", hasDelay: true },
    { key: SCHEDULED_TRIGGER_KEY, label: "A una hora programada", isScheduled: true },
    {
        key: "after_automation",
        label: "Después de otra automatización",
        hasDelay: true,
        needsInternalPredecessorId: true,
    },
]

const GUEST_FILTERS = [
    { value: "all", label: "Todos los huéspedes" },
    { value: "foreign_only", label: "Solo extranjeros" },
    { value: "national_only", label: "Solo nacionales" },
]

interface Props {
    params: Record<string, unknown>
    setParams: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void
    providerSlug: string
    required?: boolean
}

interface TriggerConfigEntry {
    [key: string]: string | number | undefined
    delay_minutes?: number
    predecessor_automation_id?: number
    time_of_day?: string
    reference_date?: "checkin_date" | "checkout_date"
    offset_days?: number
}

type TriggerConfig = Record<string, TriggerConfigEntry>

function asTriggerConfig(value: unknown): TriggerConfig {
    return value && typeof value === "object" ? value as TriggerConfig : {}
}

export function TriggerConfigSection({ params, setParams, providerSlug, required = false }: Props) {
    const triggerTypes = Array.isArray(params.triggerTypes) ? (params.triggerTypes as string[]) : []
    const triggerConfig = asTriggerConfig(params.triggerConfig)
    const isSire = providerSlug.toLowerCase().replace(/-/g, "_") === "sire_colombia"
    // SIRE reporta personas, no reservas. El backend todavía no valida este
    // campo: permitir `all` hace que intente reportar nacionales a Migración.
    const guestFilter = isSire ? "foreign_only" : (params.guest_filter as string) ?? ""

    const toggleTrigger = (key: string) => {
        setParams((prev) => {
            const current = Array.isArray(prev.triggerTypes) ? (prev.triggerTypes as string[]) : []
            const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
            // Drop config for de-selected triggers so we don't send orphaned entries.
            const cfg = { ...asTriggerConfig(prev.triggerConfig) }
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
            const cfg = { ...asTriggerConfig(prev.triggerConfig) }
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
            const cfg = { ...asTriggerConfig(prev.triggerConfig) }
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
        <div className="space-y-3 rounded-xl border border-rule bg-sunk/60 p-4">
            <div className="flex items-center gap-2">
                <Zap size={15} className="text-primary" />
                <h4 className="text-sm font-bold text-ink">Disparador</h4>
                <span className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                    {required ? "Requerido" : "Opcional"}
                </span>
            </div>
            <p className="text-xs text-ink-3 -mt-1">Define cuándo se ejecuta esta automatización y a qué huéspedes aplica.</p>
            {required && triggerTypes.length === 0 && (
                <p className="text-xs font-medium text-warning">
                    Selecciona al menos un disparador. Sin él, la automation queda activa pero el backend la omite en silencio.
                </p>
            )}

            {/* Trigger types */}
            <div className="space-y-2">
                <Label variant="plain" className="text-xs font-semibold text-ink-2">¿Cuándo se ejecuta?</Label>
                {TRIGGER_TYPES.map((t) => {
                    const checked = triggerTypes.includes(t.key)
                    return (
                        <div key={t.key} className="rounded-lg border border-rule bg-white px-3 py-2">
                            <Label variant="plain" className="flex items-center gap-2.5 cursor-pointer">
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleTrigger(t.key)}
                                    disabled={t.needsInternalPredecessorId}
                                />
                                <span className="text-sm text-ink-2">{t.label}</span>
                            </Label>

                            {t.needsInternalPredecessorId && (
                                <p className="mt-1 ml-6 text-xs text-warning">
                                    El backend exige un ID interno que no expone en este recurso. Se conserva si ya estaba configurado, pero no se puede crear desde el portal todavía.
                                </p>
                            )}

                            {checked && t.isScheduled && (
                                <ScheduledConfig config={triggerConfig[t.key] ?? {}} onChange={setScheduledField} />
                            )}

                            {checked && t.hasDelay && !t.needsInternalPredecessorId && (
                                <div className="mt-2 ml-6 flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-ink-3">Espera</span>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={triggerConfig[t.key]?.delay_minutes ?? ""}
                                            onChange={(e) =>
                                                setTriggerConfigValue(t.key, "delay_minutes", e.target.value === "" ? undefined : Number(e.target.value))
                                            }
                                            placeholder="0"
                                            className="w-20 bg-sunk/50 border border-rule rounded-lg px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                        <span className="text-xs text-ink-3">min</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Guest filter */}
            <div className="space-y-2 pt-1">
                <Label variant="plain" className="text-xs font-semibold text-ink-2">¿A qué huéspedes aplica?</Label>
                <div className="flex flex-wrap gap-2">
                    {GUEST_FILTERS.map((g) => {
                        const active = guestFilter === g.value
                        return (
                            <UnstyledButton
                                key={g.value}
                                type="button"
                                onClick={() => setGuestFilter(g.value)}
                                disabled={isSire}
                                className={
                                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                                    (active
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-rule bg-white text-ink-2 hover:bg-sunk/50")
                                }
                            >
                                {g.label}
                            </UnstyledButton>
                        )
                    })}
                </div>
                {isSire && (
                    <p className="text-xs text-ink-3">
                        SIRE se limita obligatoriamente a huéspedes extranjeros para no reportar nacionales a Migración Colombia.
                    </p>
                )}
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
    config: TriggerConfigEntry
    onChange: (field: string, value: string | number | undefined) => void
}) {

    // Backend stores HH:MM:SS; the native time input works in HH:MM.
    const timeValue = ((config.time_of_day as string) ?? "").slice(0, 5)
    const referenceDate = (config.reference_date as string) ?? "checkin_date"

    return (
        <div className="mt-2 ml-6 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-3">A las</span>
                <Input
                    type="time"
                    value={timeValue}
                    onChange={(e) =>
                        onChange("time_of_day", e.target.value ? `${e.target.value}:00` : undefined)
                    }
                    className="h-8 w-auto"  // densidad compacta; borde y foco de la primitiva
                />
                <span className="text-xs text-ink-3">del</span>
                <Select value={referenceDate} onValueChange={(value) => onChange("reference_date", value)}>
                    <SelectTrigger size="sm" className="w-auto" aria-label="Fecha de referencia">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="checkin_date">día de llegada</SelectItem>
                        <SelectItem value="checkout_date">día de salida</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-3">Desplazar</span>
                <Input
                    type="number"
                    value={config.offset_days ?? ""}
                    onChange={(e) =>
                        onChange("offset_days", e.target.value === "" ? undefined : parseInt(e.target.value, 10))
                    }
                    placeholder="0"
                    className="w-20 bg-sunk/50 border border-rule rounded-lg px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-ink-3">días (− antes · + después)</span>
            </div>
        </div>
    )
}
