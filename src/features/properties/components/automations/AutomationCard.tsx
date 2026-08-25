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
import { isSignatureProvider, AUTOMATION_STATUS, mapGuestTypeToApi } from "../../types/automation"
import { ALL_SOURCES_KEY, CONTRACT_TYPE_LABELS, summarizeContractRouting } from "../../types/contract-routing"
import type { PropertyAutomation, AutomationDefinition, Provider } from "../../types/automation"
import type { ReservationSource } from "../../services/reservation-source-service"
import { ApiError } from "@/types/api"
import { ConfigModal } from "./ConfigModal"
import { ListingOverridesPanel } from "./ListingOverridesPanel"
import type { ListingMeta } from "./AutomationOverrideModal"

const BACKEND_PENDING_MSG = "El backend aún no tiene este endpoint implementado. Contacta al equipo de desarrollo."

/** Traduce el fallo de una acción de la tarjeta al mensaje que corresponde. */
function notifyAutomationError(err: unknown, fallback: string): void {
    if (err instanceof ApiError && err.status === 405) {
        toast.error(BACKEND_PENDING_MSG, { duration: 6000 })
        return
    }
    notifyError(err, fallback)
}

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
    /**
     * `null` = el provider declara este slot para el país, pero la propiedad aún
     * no tiene su fila. El PM puede crearla desde esta tarjeta; se crea inactiva
     * y luego se configura/activa por el endpoint específico de configuración.
     */
    automation: PropertyAutomation | null
    propertyUuid: string
    providers: Provider[]
    listings: ListingMeta[]
    onChanged: (updated: PropertyAutomation | null) => void
    /** Jumps to the Documentos tab — only used by the Digital Contract card. */
    onNavigateToDocuments?: () => void
    /**
     * Catálogo de canales de reserva, solo para traducir las claves de
     * `by_source` a nombres en la tarjeta de Contrato. Cosmético: si falta, la
     * tarjeta muestra el id crudo del canal en vez de ocultar el routing.
     */
    sources?: ReservationSource[]
}

export function AutomationCard({
    definition,
    automation,
    propertyUuid,
    providers,
    listings,
    onChanged,
    onNavigateToDocuments,
    sources,
}: Props) {
    const isActive = automation?.isActive ?? false
    // La tarjeta de Contrato NO elige proveedor acá. Quién firma se decide por canal en
    // Documentos (`parameters.by_source[].provider_slug`), que es el único campo
    // que el portal del huésped consume y el único filtrado por
    // `contract_types` — la firma nativa no puede firmar una garantía. Un
    // selector propio en esta tarjeta escribía otro campo (`provider_id`), no
    // cambiaba quién firma de verdad y habilitaba esa combinación inválida. Acá
    // se muestra lo configurado y se enciende/apaga; nada más.
    const isContractRouting = definition.id === "digital-contract"
        || (!!automation?.provider && isSignatureProvider(automation.provider))
    const routingSummary = isContractRouting
        ? summarizeContractRouting(automation?.parameters)
        : null
    const providerName = automation?.providerName
        ?? getProviderSlug(providers.find(p => p.id === automation?.providerId))
        ?? null

    const findProviderId = useCallback((slug: string | null): number | undefined => {
        if (!slug) return undefined
        const target = normalizeSlug(slug)
        return providers.find(p => normalizeSlug(getProviderSlug(p)) === target)?.id
    }, [providers])

    /**
     * Nombre visible de un proveedor de firma a partir del slug guardado en el
     * routing. Cae al slug crudo si el catálogo no lo tiene: mostrar el dato real
     * es mejor que ocultar la fila configurada.
     */
    const signatureProviderLabel = useCallback((slug: string | null): string | null => {
        if (!slug) return null
        const target = normalizeSlug(slug)
        return providers.find(p => normalizeSlug(getProviderSlug(p)) === target)?.name ?? slug
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
    // `effectiveProviderName` es null mientras no haya fila ni elección: sin el
    // fallback al slug de la opción seleccionada, una automatización de un solo
    // proveedor (TTLock, PDF, TRA, SIRE, TuFirma) nunca resuelve su id contra
    // `/providers` y el activarla muere en "falta elegir proveedor".
    const activationProviderId = findProviderId(effectiveProviderName ?? selectedProvider?.value ?? null)
        ?? automation?.providerId
        ?? selectedProvider?.providerId
    const requiresProviderToActivate = definition.id === "identity-verification-main"
        || definition.id === "identity-verification-secondary"

    // Whether the SELECTED provider actually has config fields to fill. The
    // definition-level `requiresConfig` is coarse; what really matters is the
    // chosen provider's schema. Contrato (TuFirma / HIT native) has an empty
    // parametersSchema — HIT manages the creds — so it must activate directly
    // instead of bouncing to an empty config modal (the "no se puede activar" bug).
    const selectedProviderNeedsConfig = (selectedProvider?.parametersSchema?.length ?? 0) > 0

    /**
     * Claves REQUERIDAS por el esquema del proveedor que todavía no tienen valor.
     * Un array vacío cuenta como faltante: TTLock exige al menos una cerradura, y
     * `locks: []` pasaría cualquier chequeo de "existe la clave".
     */
    const missingRequiredParams = (selectedProvider?.parametersSchema ?? [])
        .filter((field) => field.required)
        .filter((field) => {
            const value = (automation?.parameters ?? {})[field.key]
            if (Array.isArray(value)) return value.length === 0
            return value == null || value === ""
        })
        .map((field) => field.key)
    const hasOperationalTrigger = Array.isArray(automation?.parameters?.triggerTypes)
        && automation.parameters.triggerTypes.length > 0

    const createInactiveAutomation = useCallback(async () => {
        if (activationProviderId == null) {
            throw new Error("El proveedor de esta automatización no está disponible para la propiedad.")
        }
        return automationService.create({
            propertyUuid,
            providerId: activationProviderId,
            name: definition.title,
            guestType: mapGuestTypeToApi(definition.guestType),
            executionOrder: definition.order,
            parameters: {},
            statusProviderId: AUTOMATION_STATUS.INACTIVE,
        })
    }, [activationProviderId, definition, propertyUuid])

    // ── Toggle active / inactive ──────────────────────────────────────────────

    const handleToggle = useCallback(async (checked: boolean) => {
        if (!propertyUuid) {
            toast.error("Guarda la propiedad antes de configurar automatizaciones")
            return
        }
        // La firma no se enciende desde acá mientras no haya routing: su fila
        // nace en Documentos, con el proveedor DERIVADO de lo que el PM eligió
        // por canal. Activarla antes crearía una automatización que no sabe qué
        // ni con quién firmar.
        if (checked && isContractRouting && (!automation || !routingSummary)) {
            toast.info("Configura primero qué se firma y quién firma, en la pestaña Documentos.")
            onNavigateToDocuments?.()
            return
        }
        // El backend exige `providerId` al activar cualquiera de las dos
        // verificaciones de identidad, y crear una fila nueva lo exige siempre.
        // No enviamos un payload incompleto que inevitablemente termina en 422.
        if (checked && requiresProviderToActivate && activationProviderId == null) {
            toast.error(
                definition.providerOptions.length > 1
                    ? "Selecciona un proveedor antes de activar esta automatización."
                    : "El proveedor de esta automatización todavía no está habilitado en el backend.",
            )
            return
        }
        // Turning ON an automation that still needs its credentials (recipients, TRA
        // token+rnt, SIRE creds…) → open the config modal instead of failing activation
        // with a 422. Saving the config activates it.
        if (checked && selectedProviderNeedsConfig) {
            // Se mira si están TODOS los requeridos, no si hay "alguno": con una
            // configuración a medias esto intentaba activar, el backend devolvía
            // 422, y el botón "Configurar" —que solo se veía estando activa— no
            // aparecía. El PM quedaba sin camino para terminar de cargarla.
            if (missingRequiredParams.length > 0 || !hasOperationalTrigger) {
                setConfigOpen(true)
                toast.info(
                    !hasOperationalTrigger
                        ? "Selecciona al menos un disparador antes de activar esta automatización."
                        : "Completa la configuración para activar esta automatización.",
                )
                return
            }
        }
        setToggling(true)
        let createdTarget: PropertyAutomation | null = null
        try {
            let target = automation
            if (!target) {
                target = await createInactiveAutomation()
                createdTarget = target
            }
            const result = await automationService.toggle(target.uuid, checked, activationProviderId)

            onChanged({
                ...result,
                provider: result.provider ?? target.provider,
                providerName: result.providerName ?? target.providerName,
            })
            toast.success(checked ? `${definition.title} activado` : `${definition.title} desactivado`)
        } catch (err) {
            // El POST ya pudo haber creado la fila aunque falle la activación.
            // Retenerla evita que el siguiente intento mande otro POST duplicado.
            if (createdTarget) onChanged(createdTarget)
            // Activating an automation can fail validation: the backend returns the
            // missing config fields (parameters.token, parameters.recipients, …).
            // Surface that list instead of a generic message.
            notifyAutomationError(err, "Error al actualizar la automatización")
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
        missingRequiredParams,
        hasOperationalTrigger,
        isContractRouting,
        routingSummary,
        onNavigateToDocuments,
        createInactiveAutomation,
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

        // Una fila inactiva —o inexistente— necesita que el usuario pueda escoger
        // proveedor ANTES de activarla, pero no hace falta guardar un estado
        // intermedio. El toggle siguiente enviará juntos statusProviderId=8 +
        // providerId, que es el payload atómico exigido por el backend; si la fila
        // todavía no existe, ese mismo toggle la crea con el proveedor elegido.
        if (!automation?.isActive) {
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
            // Siempre sobre una fila existente: este camino nunca crea.
            notifyAutomationError(err, "Error al cambiar el proveedor")
            rollback()
        }
    }, [propertyUuid, automation, definition, findProviderId, onChanged, providers])

    // ── Save config parameters ────────────────────────────────────────────────

    const handleSaveConfig = useCallback(async (params: Record<string, unknown>) => {
        if (!propertyUuid) return
        if (!Array.isArray(params.triggerTypes) || params.triggerTypes.length === 0) {
            toast.error("Selecciona al menos un disparador. Sin él, la automatización no puede ejecutarse.")
            return
        }
        setConfigSaving(true)
        let createdTarget: PropertyAutomation | null = null
        try {
            // Strip the front-only "_init" marker so it isn't persisted/validated.
            let cleanParams = Object.fromEntries(
                Object.entries(params).filter(([key]) => key !== "_init"),
            )
            const selectedSlug = normalizeSlug(selectedProvider?.value)
            if (selectedSlug === normalizeSlug("sire_colombia")) {
                // Backend gap documented in the tracker: `guest_filter` is not
                // validated, but SIRE must never receive nationals. Enforce the
                // only safe value at the write boundary, not just visually.
                cleanParams = { ...cleanParams, guest_filter: "foreign_only" }
            }
            let target = automation
            if (!target) {
                target = await createInactiveAutomation()
                createdTarget = target
            }
            const result = await automationService.configure(target.uuid, {
                statusProviderId: AUTOMATION_STATUS.ACTIVE,
                providerId: activationProviderId,
                parameters: cleanParams,
            })
            onChanged({
                ...result,
                provider: result.provider ?? target.provider,
                providerName: result.providerName ?? target.providerName,
            })
            setConfigOpen(false)
            toast.success("Configuración guardada")
        } catch (err) {
            // Crear y configurar son dos operaciones. Si solo falla la segunda,
            // la fila inactiva ya existe y debe quedar reflejada en el estado.
            if (createdTarget) onChanged(createdTarget)
            notifyAutomationError(err, "Error al guardar la configuración")
        } finally {
            setConfigSaving(false)
        }
    }, [propertyUuid, automation, onChanged, selectedProvider, createInactiveAutomation, activationProviderId])

    // Only nag for config when the selected provider actually has fields to fill.
    const needsConfig = selectedProviderNeedsConfig
        && (missingRequiredParams.length > 0 || !hasOperationalTrigger)

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
                                            // Mandatory identity rows may arrive inactive and must
                                            // remain activatable. The backend only forbids turning
                                            // an active structural slot off.
                                            disabled={definition.isMandatory && isActive}
                                            aria-label={definition.title}
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

                            {/* Digital Contract: espejo de solo lectura del routing */}
                            {isContractRouting && (
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {routingSummary ? "Contrato configurado" : "Sin configurar"}
                                    </Label>
                                    {routingSummary ? (
                                        /* Se enumera canal · qué se firma · quién firma, porque
                                           "N canales configurados" no le decía al PM qué tiene
                                           activo. El nombre del canal es cosmético: sin catálogo
                                           se muestra el id crudo, nunca se oculta la fila. */
                                        <div className="space-y-0.5">
                                            {routingSummary.channels.map((channel) => (
                                                <p key={channel.sourceKey} className="text-sm text-slate-600">
                                                    {[
                                                        channel.sourceKey === ALL_SOURCES_KEY
                                                            ? "Todos los canales"
                                                            : sources?.find((s) => String(s.id) === channel.sourceKey)?.name
                                                                ?? `Canal ${channel.sourceKey}`,
                                                        CONTRACT_TYPE_LABELS[channel.contractType],
                                                        signatureProviderLabel(channel.providerSlug),
                                                    ].filter(Boolean).join(" · ")}
                                                </p>
                                            ))}
                                        </div>
                                    ) : isActive ? (
                                        /* Estado que esta UI no puede producir (el toggle exige
                                           routing para encender): la fila se activó por otro
                                           camino. Sin routing, el portal del huésped no resuelve
                                           contrato y el check-in avanza sin firmar — decirlo es
                                           mejor que un "sin configurar" neutro bajo un badge ACTIVO. */
                                        <p className="text-sm text-amber-700">
                                            Está activa pero sin definir qué se firma ni quién firma:
                                            los huéspedes completan su check-in sin contrato.
                                            Configúrala en la pestaña Documentos.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-500">
                                            Qué se firma y quién firma se define por canal de reserva, en
                                            la pestaña Documentos.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Footer: time indicator + config button */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Tiempo Real</span>
                                </div>
                                {/* Siempre visible: sin routing es el ÚNICO camino
                                    para configurar la firma, y con routing es
                                    donde se cambia quién firma. */}
                                {isContractRouting && onNavigateToDocuments && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={onNavigateToDocuments}
                                        className={cn(
                                            "h-8 text-xs font-bold gap-1.5 px-3 hover:bg-[var(--color-brand-purple)]/5",
                                            routingSummary
                                                ? "text-[var(--color-brand-purple)]"
                                                : "text-amber-600 hover:text-amber-700",
                                        )}
                                    >
                                        {!routingSummary && <AlertCircle size={13} />}
                                        <FileSignature className="h-3.5 w-3.5" />
                                        {routingSummary ? "Configurar contrato y firma" : "Configurar (requerido)"}
                                    </Button>
                                )}
                                {!isContractRouting && selectedProviderNeedsConfig && selectedProvider && (
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
