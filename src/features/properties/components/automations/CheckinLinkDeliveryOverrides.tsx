"use client"

import { useCallback, useState } from "react"
import { Building2, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { automationService } from "../../services/automation-service"
import {
    LISTING_OVERRIDE_STATUS,
    type ListingAutomationOverride,
    type PropertyAutomation,
} from "../../types/automation"
import {
    CHANNEL_LABEL,
    buildChannels,
    describeChannels,
    optionalChannelsOf,
    readChannelErrors,
    readOverrideSelection,
    resolveEffectiveChannels,
    sameOverrideSelection,
    type DeliveryOverrideSelection,
    type OptionalDeliveryChannel,
} from "../../lib/checkin-link-delivery"
import type { ListingMeta } from "./AutomationOverrideModal"

/**
 * Estado de carga por unidad. Se distingue «falló» de «no cargado» a propósito:
 * una consulta rechazada dejaba la fila deshabilitada para siempre, porque el
 * panel solo volvía a consultar con el mapa vacío.
 */
type ListingEntry =
    | { state: "loaded"; override: ListingAutomationOverride | null }
    | { state: "failed" }

type EntriesMap = Record<string, ListingEntry | undefined>

interface Props {
    automation: PropertyAutomation
    listings: ListingMeta[]
    /** Pista §13.3 de la propiedad: ofrece la casilla de OTA por unidad. */
    pmsConnected: boolean
}

/**
 * Pantalla 2 del contrato (§5 + §13.4), dentro de la tarjeta de la propiedad:
 * es el mismo lugar donde viven los demás overrides por unidad
 * (`ListingOverridesPanel`), y así el PM ve de qué se separa cada unidad.
 *
 * Cada unidad hereda, o configura su propio conjunto de canales (email fijo).
 * «Heredar» borra el override; «configurar distinto» escribe un override
 * ACTIVO cuyo `channels` reemplaza entero el de la propiedad.
 *
 * Quien lo monta pasa `key={automation.uuid}`: al cambiar de automatización o
 * de propiedad el estado se descarta entero en vez de mezclar unidades.
 */
export function CheckinLinkDeliveryOverrides({ automation, listings, pmsConnected }: Props) {
    const [entries, setEntries] = useState<EntriesMap>({})
    const [expanded, setExpanded] = useState(false)
    const [loadingUuids, setLoadingUuids] = useState<ReadonlySet<string>>(new Set())

    const inherited = describeChannels(resolveEffectiveChannels({ automation }))

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
        const pending = listings.filter((listing) => entries[listing.uuid]?.state !== "loaded")
        await loadListings(pending)
    }, [listings, entries, loadListings])

    const handleToggleExpand = async () => {
        if (!expanded) await loadPending()
        setExpanded((value) => !value)
    }

    const loadedEntries = listings.flatMap((listing) => {
        const entry = entries[listing.uuid]
        return entry?.state === "loaded" ? [entry] : []
    })
    const overrideCount = loadedEntries.filter((entry) => entry.override != null).length
    const failedCount = listings.filter((listing) => entries[listing.uuid]?.state === "failed").length
    const allLoaded = loadedEntries.length === listings.length
    const loading = loadingUuids.size > 0

    return (
        <div className="border-t border-slate-100 pt-2">
            <button
                type="button"
                onClick={() => void handleToggleExpand()}
                className="group flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
                <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-slate-400 group-hover:text-slate-600" />
                    <span>Por unidad</span>
                    {overrideCount > 0 && (
                        <Badge variant="outline" className="h-4 border-primary/20 bg-primary/10 text-[9px] font-bold uppercase text-primary">
                            {overrideCount} distinta{overrideCount > 1 ? "s" : ""}
                        </Badge>
                    )}
                    {overrideCount === 0 && allLoaded && (
                        <span className="text-[10px] font-normal text-slate-400">Todas heredan: {inherited}</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
            </button>

            {expanded && (
                <div className="mt-2 space-y-1.5 pl-1">
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
                    <ul className="space-y-1.5">
                        {listings.map((listing) => {
                            const entry = entries[listing.uuid]
                            const isLoading = loadingUuids.has(listing.uuid)
                            if (entry?.state === "failed" && !isLoading) {
                                return (
                                    <li key={listing.uuid} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-slate-700">{listing.name}</p>
                                            <p className="text-[10px] text-amber-700">No se pudo cargar</p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => void loadListings([listing])}>
                                            <RefreshCw size={12} /> Reintentar
                                        </Button>
                                    </li>
                                )
                            }
                            if (entry?.state !== "loaded") {
                                return (
                                    <li key={listing.uuid} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                        <p className="truncate text-xs font-semibold text-slate-700">{listing.name}</p>
                                        <Loader2 size={12} className="animate-spin text-slate-400" />
                                    </li>
                                )
                            }
                            return (
                                <ListingDeliveryRow
                                    key={listing.uuid}
                                    listing={listing}
                                    automationUuid={automation.uuid}
                                    override={entry.override}
                                    inherited={inherited}
                                    pmsConnected={pmsConnected}
                                    onSaved={(next) =>
                                        setEntries((prev) => ({ ...prev, [listing.uuid]: { state: "loaded", override: next } }))
                                    }
                                />
                            )
                        })}
                    </ul>
                </div>
            )}
        </div>
    )
}

/** Una unidad cargada: su propio borrador, su propio guardado y sus propios errores. */
function ListingDeliveryRow({
    listing,
    automationUuid,
    override,
    inherited,
    pmsConnected,
    onSaved,
}: {
    listing: ListingMeta
    automationUuid: string
    override: ListingAutomationOverride | null
    inherited: string
    pmsConnected: boolean
    onSaved: (next: ListingAutomationOverride | null) => void
}) {
    const persisted = readOverrideSelection(override)
    const [draft, setDraft] = useState<DeliveryOverrideSelection | null>(null)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<string[]>([])

    const current = draft ?? persisted
    const dirty = draft != null && !sameOverrideSelection(draft, persisted)
    const selectedOptional = current.kind === "custom" ? optionalChannelsOf(current.channels) : new Set<OptionalDeliveryChannel>()
    const persistedOptional = persisted.kind === "custom" ? optionalChannelsOf(persisted.channels) : new Set<OptionalDeliveryChannel>()
    // Misma regla que en la propiedad: OTA con la pista, si está elegida o si
    // está GUARDADA. Lo guardado cuenta aparte de lo elegido: pasar el borrador
    // por «heredar» vacía la selección, y sin esta pata la casilla desaparecía
    // y guardar borraba la OTA persistida sin que el PM la tocara.
    const showOta = pmsConnected || selectedOptional.has("ota_inbox") || persistedOptional.has("ota_inbox")

    const choose = (next: DeliveryOverrideSelection) => {
        setDraft(next)
        setErrors([])
    }
    const toggle = (channel: OptionalDeliveryChannel, checked: boolean) => {
        const next = new Set(selectedOptional)
        if (checked) next.add(channel)
        else next.delete(channel)
        choose({ kind: "custom", channels: buildChannels(next) })
    }

    const save = async () => {
        if (!dirty || !draft) return
        setSaving(true)
        setErrors([])
        try {
            let next: ListingAutomationOverride | null
            if (draft.kind === "inherit") {
                if (override) await automationService.deleteListingOverride(override.uuid)
                next = null
            } else {
                const parameters = { channels: draft.channels }
                next = override
                    ? await automationService.updateListingOverride(override.uuid, {
                        statusRecordId: LISTING_OVERRIDE_STATUS.ACTIVE,
                        parameters,
                    })
                    : await automationService.createListingOverride({
                        listingUuid: listing.uuid,
                        propertyAutomationUuid: automationUuid,
                        statusRecordId: LISTING_OVERRIDE_STATUS.ACTIVE,
                        parameters,
                    })
            }
            onSaved(next)
            setDraft(null)
            toast.success(`${listing.name}: ${draft.kind === "inherit" ? `hereda (${inherited})` : describeChannels(draft.channels)}`)
        } catch (err) {
            // §13.4: los overrides validan `channels` con los mismos 422 de la propiedad.
            const messages = err instanceof ApiError ? readChannelErrors(err.errors) : []
            if (messages.length > 0) setErrors(messages)
            else notifyError(err, `No se pudo guardar el envío para ${listing.name}`)
        } finally {
            setSaving(false)
        }
    }

    const name = `delivery-${listing.uuid}`
    return (
        <li className="space-y-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700">
                    {listing.name}
                    {listing.internalName && <span className="ml-2 font-normal text-slate-400">{listing.internalName}</span>}
                </p>
                {/* Siempre en texto qué hereda, para que el PM vea de qué se separa (§5). */}
                <p className="text-[10px] text-slate-400">Propiedad: {inherited}</p>
            </div>

            <fieldset className="space-y-1.5" disabled={saving} aria-label={`Envío del link en ${listing.name}`}>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                        type="radio"
                        name={name}
                        checked={current.kind === "inherit"}
                        onChange={() => choose({ kind: "inherit" })}
                    />
                    Usar la configuración de la propiedad
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                        type="radio"
                        name={name}
                        checked={current.kind === "custom"}
                        // Volver a «configurar distinto» RESTAURA lo persistido: si el
                        // borrador pasó por «heredar», la selección quedó vacía y partir
                        // de ella convertía el conjunto guardado en solo email.
                        onChange={() => choose(persisted.kind === "custom"
                            ? { kind: "custom", channels: [...persisted.channels] }
                            : { kind: "custom", channels: buildChannels(selectedOptional) })}
                    />
                    Configurar distinto para esta unidad
                </label>

                {current.kind === "custom" && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-5 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                            <Checkbox checked disabled aria-label={`${CHANNEL_LABEL.email} en ${listing.name}`} />
                            {CHANNEL_LABEL.email}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Checkbox
                                checked={selectedOptional.has("whatsapp")}
                                onCheckedChange={(value) => toggle("whatsapp", value === true)}
                                aria-label={`${CHANNEL_LABEL.whatsapp} en ${listing.name}`}
                            />
                            {CHANNEL_LABEL.whatsapp}
                        </span>
                        {showOta && (
                            <span className="flex items-center gap-1.5">
                                <Checkbox
                                    checked={selectedOptional.has("ota_inbox")}
                                    onCheckedChange={(value) => toggle("ota_inbox", value === true)}
                                    aria-label={`${CHANNEL_LABEL.ota_inbox} en ${listing.name}`}
                                />
                                {CHANNEL_LABEL.ota_inbox}
                            </span>
                        )}
                    </div>
                )}
            </fieldset>

            {errors.length > 0 && (
                <div className="space-y-0.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700" role="alert">
                    {errors.map((message) => <p key={message}>{message}</p>)}
                </div>
            )}

            {dirty && (
                <div className="flex justify-end">
                    <Button type="button" size="sm" className="h-7 gap-1 text-xs" onClick={() => void save()} disabled={saving}>
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        Guardar
                    </Button>
                </div>
            )}
        </li>
    )
}
