"use client"

import { useState, useCallback } from "react"
import { Building2, Ban, ChevronDown, ChevronUp, Settings2, Loader2, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { automationService } from "../../services/automation-service"
import { getOverrideFieldSchema } from "../../data/automation-definitions"
import type { PropertyAutomation, ListingAutomationOverride } from "../../types/automation"
import { AutomationOverrideModal, type ListingMeta } from "./AutomationOverrideModal"

// Map shape: listingUuid → override (undefined = not loaded, null = no override set)
type OverridesMap = Record<string, ListingAutomationOverride | null | undefined>

interface Props {
    automation: PropertyAutomation
    listings: ListingMeta[]
}

export function ListingOverridesPanel({ automation, listings }: Props) {
    const [overridesMap, setOverridesMap] = useState<OverridesMap>({})
    const [expanded, setExpanded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [editingListing, setEditingListing] = useState<ListingMeta | null>(null)

    const slug = automation.provider?.parameters?.slug ?? automation.providerName ?? ""
    const fieldSchema = getOverrideFieldSchema(slug)

    const loadOverrides = useCallback(async () => {
        if (listings.length === 0) return
        setLoading(true)
        try {
            const results = await Promise.allSettled(
                listings.map(l =>
                    automationService.listListingOverrides(l.uuid).then(overrides => ({
                        listingUuid: l.uuid,
                        override: overrides.find(o => o.propertyAutomationUuid === automation.uuid) ?? null,
                    }))
                )
            )
            const map: OverridesMap = {}
            for (const r of results) {
                if (r.status === "fulfilled") map[r.value.listingUuid] = r.value.override
            }
            setOverridesMap(map)
        } finally {
            setLoading(false)
        }
    }, [listings, automation.uuid])

    const handleToggleExpand = async () => {
        if (!expanded && Object.keys(overridesMap).length === 0) {
            await loadOverrides()
        }
        setExpanded(v => !v)
    }

    const overrideCount = Object.values(overridesMap).filter(v => v !== null && v !== undefined).length
    const alreadyLoaded = Object.keys(overridesMap).length > 0

    return (
        <div className="border-t border-slate-100 pt-2">
            {/* Toggle header */}
            <button
                type="button"
                onClick={handleToggleExpand}
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
                    {listings.length > 0 && overrideCount === 0 && !loading && alreadyLoaded && (
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
                            {listings.map(listing => {
                                const override = overridesMap[listing.uuid]
                                const isLoaded = listing.uuid in overridesMap
                                const hasOverride = override !== null && override !== undefined
                                const isDisabledHere = hasOverride && !override.isActive
                                const params = hasOverride ? (override.parameters ?? {}) : {}
                                const hasParams = hasOverride && override.isActive &&
                                    Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
                                const hasToken = hasOverride && override.token != null

                                return (
                                    <button
                                        key={listing.uuid}
                                        type="button"
                                        onClick={() => setEditingListing(listing)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-sm",
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

            {/* Create/edit modal */}
            {editingListing && (
                <AutomationOverrideModal
                    open={!!editingListing}
                    onClose={() => setEditingListing(null)}
                    listingUuid={editingListing.uuid}
                    listingName={editingListing.name}
                    propertyAutomations={[automation]}
                    override={overridesMap[editingListing.uuid] ?? null}
                    lockedPropertyAutomationUuid={automation.uuid}
                    onSaved={saved => {
                        setOverridesMap(prev => ({ ...prev, [editingListing.uuid]: saved }))
                        setEditingListing(null)
                    }}
                />
            )}
        </div>
    )
}
