"use client"

import { useState, useCallback } from "react"
import { Building2, Ban, ChevronDown, ChevronUp, Settings2, Loader2, Lock, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { automationService } from "../../services/automation-service"
import { getOverrideFieldSchema } from "../../data/automation-definitions"
import type { PropertyAutomation, ListingAutomationOverride } from "../../types/automation"
import { AutomationOverrideModal, type ListingMeta } from "./AutomationOverrideModal"

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
    const overrideCount = loadedEntries.filter((entry) => entry.override != null).length
    const failedCount = listings.filter((listing) => entries[listing.uuid]?.state === "failed").length
    const allLoaded = loadedEntries.length === listings.length
    const loading = loadingUuids.size > 0
    const editingEntry = editingListing ? entries[editingListing.uuid] : undefined

    return (
        <div className="border-t border-slate-100 pt-2">
            {/* Toggle header */}
            <button
                type="button"
                onClick={() => void handleToggleExpand()}
                className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-slate-400 group-hover:text-slate-600" />
                    <span>Overrides por unidad</span>
                    {overrideCount > 0 && (
                        <Badge variant="outline" className="h-4 text-[9px] bg-primary/10 text-primary border-primary/20 font-bold uppercase">
                            {overrideCount} configurada{overrideCount > 1 ? "s" : ""}
                        </Badge>
                    )}
                    {listings.length > 0 && overrideCount === 0 && allLoaded && (
                        <span className="text-[10px] text-slate-400 font-normal">Todas heredan de la propiedad</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
            </button>

            {/* Listings list */}
            {expanded && (
                <div className="mt-2 space-y-1.5 pl-1">
                    {listings.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">No hay unidades en esta propiedad.</p>
                    ) : (
                        <>
                            {failedCount > 0 && !loading && (
                                <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    <span>
                                        No se pudo cargar la configuración de {failedCount === 1 ? "una unidad" : `${failedCount} unidades`}.
                                    </span>
                                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => void loadPending()}>
                                        <RefreshCw size={12} /> Reintentar
                                    </Button>
                                </div>
                            )}
                            {listings.map(listing => {
                                const entry = entries[listing.uuid]
                                const isLoading = loadingUuids.has(listing.uuid)
                                const isLoaded = entry?.state === "loaded"
                                const isFailed = entry?.state === "failed" && !isLoading
                                const override = isLoaded ? entry.override : null
                                const hasOverride = override != null
                                const isDisabledHere = hasOverride && !override.isActive
                                const params = hasOverride ? (override.parameters ?? {}) : {}
                                const hasParams = hasOverride && override.isActive &&
                                    Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
                                const hasToken = hasOverride && override.token != null

                                if (isFailed) {
                                    return (
                                        <div
                                            key={listing.uuid}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/60"
                                        >
                                            <div className="h-2 w-2 rounded-full shrink-0 bg-amber-400" />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs font-semibold text-slate-700 truncate">{listing.name}</span>
                                                <p className="text-[10px] text-amber-700">No se pudo cargar</p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 gap-1 text-xs"
                                                onClick={() => void loadListings([listing])}
                                            >
                                                <RefreshCw size={12} /> Reintentar
                                            </Button>
                                        </div>
                                    )
                                }

                                return (
                                    <button
                                        key={listing.uuid}
                                        type="button"
                                        // Sin cargar no se edita: el modal decidiría crear/actualizar
                                        // sin saber si la unidad ya tiene override.
                                        disabled={!isLoaded}
                                        onClick={() => setEditingListing(listing)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-sm disabled:cursor-wait disabled:opacity-70",
                                            isDisabledHere
                                                ? "border-red-200 bg-red-50/60 hover:border-red-300"
                                                : hasParams
                                                    ? "border-primary/20 bg-primary/5 hover:border-primary/20"
                                                    : "border-slate-100 bg-white hover:border-slate-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-2 w-2 rounded-full shrink-0",
                                            isDisabledHere ? "bg-red-400" : hasParams ? "bg-primary/100" : "bg-slate-300"
                                        )} />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-semibold text-slate-700 truncate">
                                                    {listing.name}
                                                </span>
                                                {listing.internalName && (
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        {listing.internalName}
                                                    </span>
                                                )}
                                                {hasToken && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500">
                                                        <Lock size={9} /> token
                                                    </span>
                                                )}
                                            </div>

                                            {!isLoaded ? (
                                                <span className="text-[10px] text-slate-400">Cargando...</span>
                                            ) : isDisabledHere ? (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Ban size={10} className="text-red-400" />
                                                    <span className="text-[10px] text-red-500 font-medium">
                                                        Desactivada en esta unidad
                                                    </span>
                                                </div>
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
                                                            <span key={field.key} className="text-[10px] text-primary font-mono">
                                                                {field.key}: {display}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400">Hereda de la propiedad</span>
                                            )}
                                        </div>

                                        <Settings2 size={12} className="text-slate-300 shrink-0" />
                                    </button>
                                )
                            })}
                            <p className="text-[10px] text-slate-400 text-center py-1">
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
                />
            )}
        </div>
    )
}
