"use client"

import { useState, useCallback, useEffect } from "react"
import { Settings2, Loader2, AlertCircle, Clock } from "lucide-react"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { cn } from "@/lib/utils"
import { automationService } from "../../services/automation-service"
import { mapGuestTypeToApi, AUTOMATION_STATUS } from "../../types/automation"
import type { PropertyAutomation, AutomationDefinition, Provider } from "../../types/automation"
import { ApiError } from "@/types/api"
import { ConfigModal } from "./ConfigModal"
import { ListingOverridesPanel } from "./ListingOverridesPanel"
import type { ListingMeta } from "./AutomationOverrideModal"

const BACKEND_PENDING_MSG = "El backend aún no tiene este endpoint implementado. Contacta al equipo de desarrollo."

interface Props {
    definition: AutomationDefinition
    automation: PropertyAutomation | null
    propertyUuid: string
    providers: Provider[]
    listings: ListingMeta[]
    onChanged: (updated: PropertyAutomation | null) => void
}

export function AutomationCard({
    definition,
    automation,
    propertyUuid,
    providers,
    listings,
    onChanged,
}: Props) {
    const isActive = automation?.isActive ?? false

    // Slug matching tolerant to "-" vs "_", casing, and `parameters` arriving as a
    // JSON string instead of an object (varies per provider record).
    const normalizeSlug = (s: string | null | undefined) =>
        (s ?? "").toLowerCase().replace(/-/g, "_")

    const getProviderSlug = (p: Provider | undefined | null): string | null => {
        let params: any = p?.parameters
        if (typeof params === "string") {
            try { params = JSON.parse(params) } catch { params = null }
        }
        return params?.slug ?? params?.internalUse?.path ?? null
    }

    const providerName = automation?.providerName
        ?? getProviderSlug(providers.find(p => p.id === automation?.providerId))
        ?? null

    const findProviderId = (slug: string | null): number | undefined => {
        if (!slug) return undefined
        const target = normalizeSlug(slug)
        return providers.find(p => normalizeSlug(getProviderSlug(p)) === target)?.id
    }

    const [toggling, setToggling] = useState(false)
    const [configOpen, setConfigOpen] = useState(false)
    const [configSaving, setConfigSaving] = useState(false)
    // Optimistic provider choice: the Select holds the chosen option immediately,
    // even before (or if) the backend reflects it — so the picker doesn't snap back.
    const [optimisticProvider, setOptimisticProvider] = useState<string | null>(null)

    const effectiveProviderName = optimisticProvider ?? providerName
    const selectedProvider = definition.providerOptions.find(p => normalizeSlug(p.value) === normalizeSlug(effectiveProviderName))
        // Single-provider automations (TRA, SIRE, PDF, TTLock) default to their only
        // option, so the config modal can open even before a provider is reflected.
        ?? (definition.providerOptions.length === 1 ? definition.providerOptions[0] : null)

    // Once the server reflects the chosen provider, drop the optimistic override.
    useEffect(() => {
        if (optimisticProvider && normalizeSlug(providerName) === normalizeSlug(optimisticProvider)) {
            setOptimisticProvider(null)
        }
    }, [providerName, optimisticProvider])

    // ── Toggle active / inactive ──────────────────────────────────────────────

    const handleToggle = useCallback(async (checked: boolean) => {
        if (!propertyUuid) {
            toast.error("Guarda la propiedad antes de configurar automatizaciones")
            return
        }
        // Turning ON an automation that still needs its credentials (recipients, TRA
        // token+rnt, SIRE creds…) → open the config modal instead of failing activation
        // with a 422. Saving the config activates it.
        if (checked && definition.requiresConfig) {
            const hasParams = Object.entries(automation?.parameters ?? {})
                .some(([k, v]) => k !== "_init" && v != null && v !== "")
            if (!hasParams) {
                setConfigOpen(true)
                toast.info("Completa la configuración para activar esta automatización.")
                return
            }
        }
        setToggling(true)
        try {
            let current = automation

            // If no cached record, refresh — the backend may have auto-created it
            if (!current) {
                const fresh = await automationService.listGlobal({ propertyUuid })
                current = fresh.find(a => a.executionOrder === definition.order) ?? null
                if (current) onChanged(current)
            }

            const result = current
                ? await automationService.toggle(current.uuid, checked, current.providerId)
                : await automationService.create({
                    propertyUuid,
                    name: definition.title,
                    guestType: mapGuestTypeToApi(definition.guestType),
                    executionOrder: definition.order,
                    parameters: { _init: true },
                    statusProviderId: checked ? AUTOMATION_STATUS.ACTIVE : AUTOMATION_STATUS.INACTIVE,
                    providerId: findProviderId(definition.providerOptions[0]?.value ?? null) ?? null,
                })

            onChanged(result)
            toast.success(checked ? `${definition.title} activado` : `${definition.title} desactivado`)
        } catch (err) {
            // Activating an automation can fail validation: the backend returns the
            // missing config fields (parameters.token, parameters.recipients, …).
            // Surface that list instead of a generic message.
            if (err instanceof ApiError && err.status === 405) {
                toast.error(BACKEND_PENDING_MSG, { duration: 6000 })
            } else {
                notifyError(err, "Error al actualizar la automatización")
            }
        } finally {
            setToggling(false)
        }
    }, [propertyUuid, automation, definition, onChanged])

    // ── Change provider ───────────────────────────────────────────────────────

    const handleProviderChange = useCallback(async (newProvider: string) => {
        if (!propertyUuid) return
        // Resolve by slug from /providers; fall back to the option's known id if the
        // provider record isn't in the list (e.g. excluded by the active-only filter).
        const providerId = findProviderId(newProvider)
            ?? definition.providerOptions.find(p => p.value === newProvider)?.providerId
        // Without a resolved providerId the configure call would silently no-op
        // (backend keeps the current provider), so the dropdown appears "stuck".
        // Surface the real reason instead of failing mutely.
        if (newProvider && providerId == null) {
            const label = definition.providerOptions.find(p => p.value === newProvider)?.label ?? newProvider
            toast.error(`"${label}" no está disponible todavía. Falta habilitar el proveedor en el backend (seed del provider).`)
            return
        }
        try {
            let current = automation

            if (!current) {
                const fresh = await automationService.listGlobal({ propertyUuid })
                current = fresh.find(a => a.executionOrder === definition.order) ?? null
                if (current) onChanged(current)
            }

            const result = current
                ? await automationService.configure(current.uuid, {
                    statusProviderId: current.statusProviderId,
                    providerId,
                })
                : await automationService.create({
                    propertyUuid,
                    name: definition.title,
                    guestType: mapGuestTypeToApi(definition.guestType),
                    executionOrder: definition.order,
                    parameters: {},
                    statusProviderId: AUTOMATION_STATUS.INACTIVE,
                    providerId: providerId ?? null,
                })

            onChanged(result)
        } catch (err) {
            if (err instanceof ApiError && err.status === 405) {
                toast.error(BACKEND_PENDING_MSG, { duration: 6000 })
            } else {
                notifyError(err, "Error al cambiar el proveedor")
            }
        }
    }, [propertyUuid, automation, definition, onChanged])

    // ── Save config parameters ────────────────────────────────────────────────

    const handleSaveConfig = useCallback(async (params: Record<string, unknown>) => {
        if (!propertyUuid) return
        setConfigSaving(true)
        try {
            // Configure the existing record, or create it if the backend hadn't
            // auto-created it yet. Saving config also activates the automation.
            const result = automation
                ? await automationService.configure(automation.uuid, {
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    parameters: params,
                })
                : await automationService.create({
                    propertyUuid,
                    name: definition.title,
                    guestType: mapGuestTypeToApi(definition.guestType),
                    executionOrder: definition.order,
                    parameters: params,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    providerId: findProviderId(selectedProvider?.value ?? null) ?? selectedProvider?.providerId ?? null,
                })
            onChanged(result)
            setConfigOpen(false)
            toast.success("Configuración guardada")
        } catch (err) {
            if (err instanceof ApiError && err.status === 405) {
                toast.error(BACKEND_PENDING_MSG, { duration: 6000 })
            } else {
                notifyError(err, "Error al guardar la configuración")
            }
        } finally {
            setConfigSaving(false)
        }
    }, [propertyUuid, automation, definition, selectedProvider, onChanged])

    // Configured = has at least one meaningful parameter (ignoring the _init marker)
    const hasMeaningfulParams = Object.entries(automation?.parameters ?? {})
        .some(([k, v]) => k !== "_init" && v != null && v !== "")
    const needsConfig = definition.requiresConfig && isActive && !hasMeaningfulParams

    const showOverridesPanel = isActive
        && !!automation
        && !!definition.listingOverrideSchema?.length
        && listings.length > 0

    return (
        <>
            <Card className={cn(
                "group overflow-hidden border-slate-200/60 hover:border-[var(--color-brand-purple)]/30 hover:shadow-md transition-all duration-300",
                isActive && "border-[var(--color-brand-purple)]/20"
            )}>
                <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-stretch">
                        {/* Icon column */}
                        <div className={cn(
                            "flex items-center justify-center w-full md:w-20 py-4 md:py-0",
                            definition.bgColor
                        )}>
                            <definition.icon className={cn("h-8 w-8", definition.color)} />
                        </div>

                        {/* Content column */}
                        <div className="flex-1 p-5 space-y-3">
                            {/* Header: title + toggle */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-bold text-slate-900 leading-none">
                                            {definition.title}
                                        </h3>
                                        {definition.isMandatory && (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] uppercase tracking-wider font-bold h-5">
                                                Obligatorio
                                            </Badge>
                                        )}
                                        {isActive && (
                                            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px] uppercase tracking-wider font-bold h-5">
                                                Activo
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 leading-relaxed">{definition.description}</p>
                                </div>
                                <div className="shrink-0">
                                    {toggling
                                        ? <Loader2 size={20} className="animate-spin text-[var(--color-brand-purple)]" />
                                        : <Switch
                                            checked={isActive}
                                            onCheckedChange={handleToggle}
                                            disabled={definition.isMandatory}
                                            className="data-[state=checked]:bg-[var(--color-brand-purple)]"
                                        />
                                    }
                                </div>
                            </div>

                            {/* Provider selector (multi-option) */}
                            {isActive && definition.providerOptions.length > 1 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Proveedor
                                    </Label>
                                    <Select
                                        value={effectiveProviderName ?? ""}
                                        onValueChange={(v) => { setOptimisticProvider(v); handleProviderChange(v) }}
                                    >
                                        <SelectTrigger className="h-9 text-sm bg-slate-50 border-slate-200 max-w-xs">
                                            <SelectValue placeholder="Selecciona proveedor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {definition.providerOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div>
                                                        <div className="font-medium">{opt.label}</div>
                                                        <div className="text-xs text-slate-500">{opt.description}</div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Provider label (single-option) */}
                            {isActive && definition.providerOptions.length === 1 && (
                                <p className="text-xs text-slate-400">
                                    Proveedor:{" "}
                                    <span className="font-semibold text-slate-600">
                                        {definition.providerOptions[0].label}
                                    </span>
                                </p>
                            )}

                            {/* Footer: time indicator + config button */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Tiempo Real</span>
                                </div>
                                {isActive && definition.requiresConfig && selectedProvider && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setConfigOpen(true)}
                                        className={cn(
                                            "h-8 text-xs font-bold gap-1.5 px-3 hover:bg-[var(--color-brand-purple)]/5",
                                            needsConfig
                                                ? "text-amber-600 hover:text-amber-700"
                                                : "text-[var(--color-brand-purple)] hover:text-[var(--color-brand-purple)]"
                                        )}
                                    >
                                        {needsConfig && <AlertCircle size={13} />}
                                        <Settings2 className="h-3.5 w-3.5" />
                                        {needsConfig ? "Configurar (requerido)" : "Configurar"}
                                    </Button>
                                )}
                            </div>

                            {/* Listing overrides panel */}
                            {showOverridesPanel && (
                                <ListingOverridesPanel
                                    automation={automation!}
                                    listings={listings}
                                />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Property-level config modal */}
            {configOpen && selectedProvider && (
                <ConfigModal
                    open={configOpen}
                    onClose={() => setConfigOpen(false)}
                    definition={definition}
                    provider={selectedProvider}
                    currentParameters={(automation?.parameters ?? {}) as Record<string, unknown>}
                    onSave={handleSaveConfig}
                    isSaving={configSaving}
                />
            )}
        </>
    )
}
