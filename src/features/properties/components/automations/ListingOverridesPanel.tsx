"use client"

import { useState, useCallback } from "react"
import { Building2, ChevronDown, ChevronUp, Settings2, Lock, RefreshCw } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { StatusPill } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { automationService } from "../../services/automation-service"
import { getOverrideFieldSchema } from "../../data/automation-definitions"
import type { PropertyAutomation, ListingAutomationOverride } from "../../types/automation"
import { AutomationOverrideModal, type ListingMeta } from "./AutomationOverrideModal"
import { useIdentityProviderCatalog } from "../../hooks/useIdentityProviderCatalog"
import { identityOverrideSummary, isIdentityPropertyAutomation } from "../../lib/identity-listing-override"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { EmptyState } from "@/components/ui/empty-state"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Spinner } from "@/components/ui/loading-state"

/**
 * Estado de carga por unidad. «Falló» se distingue de «no cargado» a propósito:
 * una consulta rechazada dejaba la fila en «Cargando…» para siempre y aun así
 * clicable, y el modal abría con `override=null` sobre una unidad que SÍ tenía
 * override — un intento de crear otro (422) o un estado falso. Con identidad
 * desactivable por listing (contrato 2026-09-27) eso ya afecta al check-in.
 */
type ListingEntry =
    | { state: "loaded"; override: ListingAutomationOverride | null }
    | { state: "failed" }

type EntriesMap = Record<string, ListingEntry | undefined>

interface Props {
    automation: PropertyAutomation
    listings: ListingMeta[]
}

export function ListingOverridesPanel({ automation, listings }: Props) {
    const [entries, setEntries] = useState<EntriesMap>({})
    const [expanded, setExpanded] = useState(false)
    const [loadingUuids, setLoadingUuids] = useState<ReadonlySet<string>>(new Set())
    const [editingListing, setEditingListing] = useState<ListingMeta | null>(null)

    const slug = automation.provider?.parameters?.slug ?? automation.providerName ?? ""
    const fieldSchema = getOverrideFieldSchema(slug)
    // Identidad se resume con la regla compartida (contrato 2026-10-14), no
    // mirando parámetros ni token: un override activo sin parámetros puede
    // heredar o tener su propio nivel.
    const isIdentity = isIdentityPropertyAutomation(automation)
    const identityCatalog = useIdentityProviderCatalog(isIdentity)

    const loadListings = useCallback(async (targets: ListingMeta[]) => {
        if (targets.length === 0) return
        setLoadingUuids((prev) => new Set([...prev, ...targets.map((l) => l.uuid)]))
        const results = await Promise.allSettled(
            targets.map((listing) => automationService.listListingOverrides(listing.uuid)),
        )
        setEntries((prev) => {
            const next = { ...prev }
            results.forEach((result, index) => {
                const uuid = targets[index].uuid
                next[uuid] = result.status === "fulfilled"
                    ? {
                        state: "loaded",
                        override: result.value.find((o) => o.propertyAutomationUuid === automation.uuid) ?? null,
                    }
                    : { state: "failed" }
            })
            return next
        })
        setLoadingUuids((prev) => {
            const next = new Set(prev)
            for (const listing of targets) next.delete(listing.uuid)
            return next
        })
    }, [automation.uuid])

    /** Carga lo que falte o haya fallado; lo ya cargado no se vuelve a pedir. */
    const loadPending = useCallback(async () => {
        await loadListings(listings.filter((listing) => entries[listing.uuid]?.state !== "loaded"))
    }, [listings, entries, loadListings])

    const handleToggleExpand = async () => {
        if (!expanded) await loadPending()
        setExpanded((v) => !v)
    }

    const loadedEntries = listings.flatMap((listing) => {
        const entry = entries[listing.uuid]
        return entry?.state === "loaded" ? [entry] : []
    })
    // En identidad, un override que hereda no cuenta como «configurada».
    const overrideCount = loadedEntries.filter((entry) => entry.override != null && (
        !isIdentity || identityOverrideSummary(entry.override, automation, identityCatalog.catalog).tone !== "inherit"
    )).length
    const failedCount = listings.filter((listing) => entries[listing.uuid]?.state === "failed").length
    const allLoaded = loadedEntries.length === listings.length
    const loading = loadingUuids.size > 0
    const editingEntry = editingListing ? entries[editingListing.uuid] : undefined

    return (
        <div className="border-t border-rule pt-2">
            {/* Toggle header */}
            <UnstyledButton
                type="button"
                onClick={() => void handleToggleExpand()}
                className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-semibold text-ink-3 hover:text-ink-2 rounded-lg hover:bg-sunk/50 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Icon icon={Building2} size="sm" className="text-ink-3 group-hover:text-ink-2" />
                    <span>Overrides por unidad</span>
                    {overrideCount > 0 && (
                        <Badge tone="accent">
                            {overrideCount} configurada{overrideCount > 1 ? "s" : ""}
                        </Badge>
                    )}
                    {listings.length > 0 && overrideCount === 0 && allLoaded && (
                        <span className="text-xs text-ink-3 font-normal">Todas heredan de la propiedad</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {loading && <Spinner size="xs" tone="muted" />}
                    {expanded ? <Icon icon={ChevronUp} size="sm" /> : <Icon icon={ChevronDown} size="sm" />}
                </div>
            </UnstyledButton>

            {/* Listings list */}
            {expanded && (
                <div className="mt-2 space-y-1.5 pl-1">
                    {listings.length === 0 ? (
                        <EmptyState title="No hay unidades en esta propiedad." className="py-4" />
                    ) : (
                        <>
                            {failedCount > 0 && !loading && (
                                <FeedbackBanner
                                    tone="warning"
                                    mode="dynamic"
                                    density="compact"
                                    action={
                                        <Button type="button" size="sm" variant="outline" onClick={() => void loadPending()}>
                                            <Icon icon={RefreshCw} /> Reintentar
                                        </Button>
                                    }
                                >
                                    No se pudo cargar la configuración de {failedCount === 1 ? "una unidad" : `${failedCount} unidades`}.
                                </FeedbackBanner>
                            )}
                            {listings.map(listing => {
                                const entry = entries[listing.uuid]
                                const isLoading = loadingUuids.has(listing.uuid)
                                const isLoaded = entry?.state === "loaded"
                                const isFailed = entry?.state === "failed" && !isLoading
                                const override = isLoaded ? entry.override : null
                                const hasOverride = override != null
                                const identity = isIdentity && isLoaded
                                    ? identityOverrideSummary(override, automation, identityCatalog.catalog)
                                    : null
                                const isDisabledHere = identity ? identity.tone === "disabled" : hasOverride && !override.isActive
                                const params = hasOverride ? (override.parameters ?? {}) : {}
                                const hasParams = identity ? identity.tone === "custom" : hasOverride && override.isActive &&
                                    Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
                                // Ruteo de contrato propio de la unidad: no son campos de este panel.
                                const ownContract = hasOverride && override.isActive && (
                                    override.contractRouting?.routingSource === "listing" || params.contract_mode != null
                                )
                                // El token de un override de identidad no aplica (el contrato lo manda null).
                                const hasToken = !isIdentity && hasOverride && override.token != null

                                if (isFailed) {
                                    return (
                                        <FeedbackBanner
                                            key={listing.uuid}
                                            tone="warning"
                                            density="compact"
                                            title={listing.name}
                                            action={
                                                <Button type="button" size="sm" variant="outline" onClick={() => void loadListings([listing])}>
                                                    <Icon icon={RefreshCw} /> Reintentar
                                                </Button>
                                            }
                                        >
                                            No se pudo cargar
                                        </FeedbackBanner>
                                    )
                                }

                                return (
                                    <UnstyledButton
                                        key={listing.uuid}
                                        type="button"
                                        // Sin cargar no se edita: el modal decidiría crear/actualizar
                                        // sin saber si la unidad ya tiene override.
                                        disabled={!isLoaded}
                                        onClick={() => setEditingListing(listing)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-sm disabled:cursor-wait disabled:opacity-70",
                                            isDisabledHere
                                                ? "border-danger/30 bg-danger-sunk/50 hover:border-danger/30"
                                                : hasParams
                                                    ? "border-primary/20 bg-primary/5 hover:border-primary/20"
                                                    : "border-rule bg-white hover:border-rule"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-2 w-2 rounded-full shrink-0",
                                            isDisabledHere ? "bg-danger" : hasParams ? "bg-primary" : "bg-ink-4"
                                        )} />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-semibold text-ink-2 truncate">
                                                    {listing.name}
                                                </span>
                                                {listing.internalName && (
                                                    <span className="text-xs text-ink-3 font-normal">
                                                        {listing.internalName}
                                                    </span>
                                                )}
                                                {hasToken && (
                                                    <span className="inline-flex items-center gap-0.5 text-xs text-ink-3">
                                                        <Icon icon={Lock} size="xs" /> token
                                                    </span>
                                                )}
                                            </div>

                                            {!isLoaded ? (
                                                <span className="text-xs text-ink-3">Cargando...</span>
                                            ) : identity ? (
                                                <StatusPill tone={identity.tone === "disabled" ? "danger" : identity.tone === "custom" ? "accent" : "idle"} className="mt-0.5">
                                                    {identity.label}
                                                </StatusPill>
                                            ) : isDisabledHere ? (
                                                <StatusPill tone="danger" className="mt-0.5">Desactivada en esta unidad</StatusPill>
                                            ) : override?.contractRouting?.replacedTexts.length ? (
                                                <span className="text-xs font-medium text-warning">Textos propios sin aplicar · revisar</span>
                                            ) : ownContract ? (
                                                <span className="text-xs text-primary font-medium">Contrato propio de la unidad</span>
                                            ) : hasParams ? (
                                                <div className="flex flex-wrap gap-x-3 mt-0.5">
                                                    {fieldSchema.map(field => {
                                                        const val = params[field.key]
                                                        if (val == null || val === "") return null
                                                        const display = field.type === "password"
                                                            ? "••••••••"
                                                            : Array.isArray(val)
                                                                ? `${val.length} elemento${val.length > 1 ? "s" : ""}`
                                                                : String(val)
                                                        return (
                                                            <span key={field.key} className="text-xs text-primary font-mono">
                                                                {field.key}: {display}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            ) : hasOverride ? (
                                                // Una fila activa sin parámetros NO es herencia: existe un
                                                // override y su estado manda (contrato de overrides). Se
                                                // quita con «Volver a heredar» en el modal.
                                                <span className="text-xs text-ink-3">Override activo sin parámetros propios</span>
                                            ) : (
                                                <span className="text-xs text-ink-3">Hereda de la propiedad</span>
                                            )}
                                        </div>

                                        <Icon icon={Settings2} size="xs" className="text-ink-4" />
                                    </UnstyledButton>
                                )
                            })}
                            <p className="text-xs text-ink-3 text-center py-1">
                                Click en una unidad para editar su override
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* Create/edit modal — solo sobre una unidad cargada */}
            {editingListing && editingEntry?.state === "loaded" && (
                <AutomationOverrideModal
                    open={!!editingListing}
                    onClose={() => setEditingListing(null)}
                    listingUuid={editingListing.uuid}
                    listingName={editingListing.name}
                    propertyAutomations={[automation]}
                    override={editingEntry.override}
                    lockedPropertyAutomationUuid={automation.uuid}
                    onSaved={saved => {
                        setEntries(prev => ({ ...prev, [editingListing.uuid]: { state: "loaded", override: saved } }))
                        setEditingListing(null)
                    }}
                    onOverrideChanged={changed => {
                        setEntries(prev => ({ ...prev, [editingListing.uuid]: { state: "loaded", override: changed } }))
                    }}
                    onInheritRestored={() => {
                        setEntries(prev => ({ ...prev, [editingListing.uuid]: { state: "loaded", override: null } }))
                        setEditingListing(null)
                    }}
                />
            )}
        </div>
    )
}
