"use client"

import { useState, useCallback, useRef } from "react"
import { Settings2, Loader2, AlertCircle, Clock, FileSignature } from "lucide-react"
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
import { isSignatureProvider, AUTOMATION_STATUS } from "../../types/automation"
import type { PropertyAutomation, AutomationDefinition, Provider } from "../../types/automation"
import { ApiError } from "@/types/api"
import { ConfigModal } from "./ConfigModal"
import { ListingOverridesPanel } from "./ListingOverridesPanel"
import type { ListingMeta } from "./AutomationOverrideModal"

const BACKEND_PENDING_MSG = "El backend aún no tiene este endpoint implementado. Contacta al equipo de desarrollo."

const normalizeSlug = (slug: string | null | undefined) =>
    (slug ?? "").toLowerCase().replace(/-/g, "_")

function getProviderSlug(provider: Provider | undefined | null): string | null {
    const raw: unknown = provider?.parameters
    let params: Record<string, unknown> | null = null
    if (typeof raw === "string") {
        try {
            const parsed: unknown = JSON.parse(raw)
            params = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null
        } catch {
            params = null
        }
    } else if (raw && typeof raw === "object") {
        params = raw as unknown as Record<string, unknown>
    }
    if (typeof params?.slug === "string") return params.slug
    const internalUse = params?.internalUse
    return internalUse && typeof internalUse === "object"
        && typeof (internalUse as Record<string, unknown>).path === "string"
        ? (internalUse as Record<string, unknown>).path as string
        : null
}

interface Props {
    definition: AutomationDefinition
    automation: PropertyAutomation
    propertyUuid: string
    providers: Provider[]
    listings: ListingMeta[]
    onChanged: (updated: PropertyAutomation | null) => void
    /** Jumps to the Documentos tab — only used by the Digital Contract card. */
    onNavigateToDocuments?: () => void
}

export function AutomationCard({
    definition,
    automation,
    propertyUuid,
    providers,
    listings,
    onChanged,
    onNavigateToDocuments,
}: Props) {
    const isActive = automation.isActive
    // Digital Contract doesn't pick one property-wide provider anymore —
    // who signs is chosen PER CHANNEL in the contract-routing screen (Documentos
    // tab). Its provider selector here would be misleading, so it's replaced with
    // a link to that screen instead (backend plan §2.3).
    const isContractRouting = definition.id === "digital-contract"
        || (!!automation.provider && isSignatureProvider(automation.provider))

    const providerName = automation?.providerName
        ?? getProviderSlug(providers.find(p => p.id === automation?.providerId))
        ?? null

    const findProviderId = useCallback((slug: string | null): number | undefined => {
        if (!slug) return undefined
        const target = normalizeSlug(slug)
        return providers.find(p => normalizeSlug(getProviderSlug(p)) === target)?.id
    }, [providers])

    const [toggling, setToggling] = useState(false)
    const [configOpen, setConfigOpen] = useState(false)
    const [configSaving, setConfigSaving] = useState(false)
    // Optimistic provider choice: the Select holds the chosen option immediately,
    // even before (or if) the backend reflects it — so the picker doesn't snap back.
    const [optimisticProvider, setOptimisticProvider] = useState<string | null>(null)
    // Last value that actually persisted, so a rejected change can be undone.
    // A ref, not state: it must not trigger a render, it only records what to
    // restore if the next attempt fails.
    const previousProviderRef = useRef<string | null>(null)

    const effectiveProviderName = optimisticProvider ?? providerName
    const selectedProvider = definition.providerOptions.find(p => normalizeSlug(p.value) === normalizeSlug(effectiveProviderName))
        // Single-provider automations (TRA, SIRE, PDF, TTLock) default to their only
        // option, so the config modal can open even before a provider is reflected.
        ?? (definition.providerOptions.length === 1 ? definition.providerOptions[0] : null)
    // La selección optimista va primero: si la fila inactiva ya tenía Didit y el
    // usuario acaba de escoger Textract, activar debe enviar la nueva elección,
    // no el providerId viejo que todavía conserva la respuesta del backend.
    const activationProviderId = findProviderId(effectiveProviderName)
        ?? automation.providerId
        ?? selectedProvider?.providerId
    const requiresProviderToActivate = definition.order <= 2

    // Whether the SELECTED provider actually has config fields to fill. The
    // definition-level `requiresConfig` is coarse; what really matters is the
    // chosen provider's schema. Firma Digital (TuFirma / HIT native) has an empty
    // parametersSchema — HIT manages the creds — so it must activate directly
    // instead of bouncing to an empty config modal (the "no se puede activar" bug).
    const selectedProviderNeedsConfig = (selectedProvider?.parametersSchema?.length ?? 0) > 0

    // ── Toggle active / inactive ──────────────────────────────────────────────

    const handleToggle = useCallback(async (checked: boolean) => {
        if (!propertyUuid) {
            toast.error("Guarda la propiedad antes de configurar automatizaciones")
            return
        }
        // El backend exige `providerId` al activar cualquiera de las dos
        // verificaciones de identidad. Una fila nueva puede venir sin proveedor;
        // en ese caso no enviamos un PATCH incompleto que inevitablemente termina
        // en 422: el PM debe elegir Didit o Textract en el selector visible.
        if (checked && requiresProviderToActivate && activationProviderId == null) {
            toast.error("Selecciona un proveedor de verificación antes de activar esta automatización.")
            return
        }
        // Turning ON an automation that still needs its credentials (recipients, TRA
        // token+rnt, SIRE creds…) → open the config modal instead of failing activation
        // with a 422. Saving the config activates it.
        if (checked && selectedProviderNeedsConfig) {
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
            const result = await automationService.toggle(
                automation.uuid,
                checked,
                activationProviderId,
            )

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
    }, [
        propertyUuid,
        automation,
        definition,
        onChanged,
        selectedProviderNeedsConfig,
        requiresProviderToActivate,
        activationProviderId,
    ])

    // ── Change provider ───────────────────────────────────────────────────────

    const handleProviderChange = useCallback(async (newProvider: string) => {
        if (!propertyUuid) return
        // The optimistic value was already applied by the Select's onValueChange so
        // the trigger doesn't flicker. Every path that does NOT persist has to undo
        // it — otherwise the picker keeps showing an option that was never saved and
        // only snaps back on the next reload, which reads exactly like "the selector
        // doesn't work".
        const rollback = () => setOptimisticProvider(previousProviderRef.current)

        // Resolve by slug from /providers; fall back to the option's known id if the
        // provider record isn't in the list (e.g. excluded by the active-only filter).
        const providerId = findProviderId(newProvider)
            ?? definition.providerOptions.find(p => p.value === newProvider)?.providerId
        // Without a resolved providerId the configure call would silently no-op
        // (backend keeps the current provider), so the dropdown appears "stuck".
        // Surface the real reason instead of failing mutely.
        if (newProvider && providerId == null) {
            const label = definition.providerOptions.find(p => p.value === newProvider)?.label ?? newProvider
            // The slugs the backend actually returned are the only way to tell a
            // missing seed apart from a slug that simply doesn't match our option
            // value. Without this the toast is a dead end for whoever debugs it.
            console.error(
                `[AutomationCard] No se pudo resolver providerId para "${newProvider}".`,
                {
                    buscado: normalizeSlug(newProvider),
                    slugsDisponibles: providers.map(p => getProviderSlug(p)),
                    providersRecibidos: providers.length,
                },
            )
            toast.error(`"${label}" no está disponible todavía. Falta habilitar el proveedor en el backend (seed del provider).`)
            rollback()
            return
        }

        // Una identidad inactiva necesita que el usuario pueda escoger proveedor
        // ANTES de activarla, pero no hace falta guardar un estado intermedio. El
        // toggle siguiente enviará juntos statusProviderId=8 + providerId, que es
        // el payload atómico exigido por el backend.
        if (!automation.isActive) {
            previousProviderRef.current = newProvider
            return
        }
        try {
            const result = await automationService.configure(automation.uuid, {
                statusProviderId: automation.statusProviderId,
                providerId,
            })

            previousProviderRef.current = newProvider
            onChanged(result)
        } catch (err) {
            if (err instanceof ApiError && err.status === 405) {
                toast.error(BACKEND_PENDING_MSG, { duration: 6000 })
            } else {
                notifyError(err, "Error al cambiar el proveedor")
            }
            rollback()
        }
    }, [propertyUuid, automation, definition, findProviderId, onChanged, providers])

    // ── Save config parameters ────────────────────────────────────────────────

    const handleSaveConfig = useCallback(async (params: Record<string, unknown>) => {
        if (!propertyUuid) return
        setConfigSaving(true)
        try {
            // Strip the front-only "_init" marker so it isn't persisted/validated.
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([key]) => key !== "_init"),
            )
            // Backend owns creation of the country-specific row. Saving config
            // only updates that existing automation and activates it.
            const result = await automationService.configure(automation.uuid, {
                statusProviderId: AUTOMATION_STATUS.ACTIVE,
                parameters: cleanParams,
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
    }, [propertyUuid, automation, onChanged])

    // Configured = has at least one meaningful parameter (ignoring the _init marker)
    const hasMeaningfulParams = Object.entries(automation?.parameters ?? {})
        .some(([k, v]) => k !== "_init" && v != null && v !== "")
    // Only nag for config when the selected provider actually has fields to fill.
    const needsConfig = selectedProviderNeedsConfig && isActive && !hasMeaningfulParams

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
                            {!isContractRouting && definition.providerOptions.length > 1 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Proveedor {requiresProviderToActivate && !isActive && "requerido para activar"}
                                    </Label>
                                    <Select
                                        value={effectiveProviderName ?? ""}
                                        onValueChange={(v) => { setOptimisticProvider(v); handleProviderChange(v) }}
                                    >
                                        <SelectTrigger className="h-9 text-sm bg-slate-50 border-slate-200 max-w-xs">
                                            {/* Render only the label in the trigger. Otherwise radix clones the
                                                option's two-line (label + description) markup into the value slot,
                                                which is flex + line-clamp-1 — clipping the text and breaking the
                                                alignment (that's why DIDIT looked unreadable). The description
                                                stays in the dropdown options below. */}
                                            <SelectValue placeholder="Selecciona proveedor">
                                                {selectedProvider?.label}
                                            </SelectValue>
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
                            {isActive && !isContractRouting && definition.providerOptions.length === 1 && (
                                <p className="text-xs text-slate-400">
                                    Proveedor:{" "}
                                    <span className="font-semibold text-slate-600">
                                        {definition.providerOptions[0].label}
                                    </span>
                                </p>
                            )}

                            {/* Digital Contract: routing lives in Documentos, per channel */}
                            {isActive && isContractRouting && (
                                <p className="text-xs text-slate-400">
                                    Qué se firma y con quién se configura por canal de reserva, en la
                                    pestaña Documentos.
                                </p>
                            )}

                            {/* Footer: time indicator + config button */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Tiempo Real</span>
                                </div>
                                {isActive && isContractRouting && onNavigateToDocuments && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={onNavigateToDocuments}
                                        className="h-8 text-xs font-bold gap-1.5 px-3 text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/5"
                                    >
                                        <FileSignature className="h-3.5 w-3.5" />
                                        Configurar contrato y firma
                                    </Button>
                                )}
                                {isActive && !isContractRouting && selectedProviderNeedsConfig && selectedProvider && (
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
