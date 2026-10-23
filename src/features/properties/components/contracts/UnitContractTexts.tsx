"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, AlertTriangle, Eye, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { validationMessages } from "@/lib/notify-error"
import { automationService } from "../../services/automation-service"
import { propertyDocumentService } from "../../services/property-document-service"
import { reservationSourceService, type ReservationSource } from "../../services/reservation-source-service"
import {
    AGREEMENT_DOCUMENT_TYPE_ID,
    DOCUMENT_STATUS,
    documentListingUuid,
    isPropertyLevelDocument,
    type PropertyDocument,
} from "../../types/document"
import { LISTING_OVERRIDE_STATUS, type ListingAutomationOverride } from "../../types/automation"
import { ApiError } from "@/types/api"
import type { ContractRoutingView } from "../../types/contract-routing"
import { describeRowSigning, planUnitTexts, type UnitTextRow } from "../../lib/unit-contract-texts"
import { DocumentEditor } from "../documents/DocumentEditor"
import { DocumentPreviewModal } from "../documents/DocumentPreviewModal"
import { ReservationSourceIdentity, reservationSourceSlug } from "./ReservationSourceIdentity"

interface Props {
    propertyUuid: string
    listingUuid: string
    propertyAutomationUuid: string
    /** El override guardado de la unidad sobre el contrato, si existe. */
    override: ListingAutomationOverride | null
    /** El ruteo de la propiedad, para saber qué canales firman cuando la unidad hereda. */
    propertyRouting: ContractRoutingView | null
    /** El override cambió (se creó, o se releyó tras escribir un texto). No cierra el modal. */
    onOverrideChanged: (override: ListingAutomationOverride) => void
    disabled?: boolean
}

interface Editing {
    key: string
    text: string
}

/**
 * «Texto del contrato de esta unidad» (contrato 2026-10-20). Cada fila guarda
 * por su cuenta: es una escritura independiente, nunca una tanda. Los textos de
 * una unidad nunca piden la confirmación `confirmUnitOverrides`.
 *
 * El texto solo aplica con el override de contrato ACTIVO. Si la unidad no tiene
 * override, se crea uno activo y sin parámetros ANTES del texto: al revés, si el
 * segundo paso fallara, quedaría un texto guardado que no aplica sin que nadie
 * lo sepa.
 */
export function UnitContractTexts({
    propertyUuid,
    listingUuid,
    propertyAutomationUuid,
    override,
    propertyRouting,
    onOverrideChanged,
    disabled = false,
}: Props) {
    const [loaded, setLoaded] = useState<{
        propertyDocuments: PropertyDocument[]
        unitDocuments: PropertyDocument[]
        sources: ReservationSource[]
        shortcodes: string[]
    } | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [editing, setEditing] = useState<Editing | null>(null)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [rowError, setRowError] = useState<{ key: string; messages: string[] } | null>(null)
    // La relectura falló y la vista puede no ser lo que hay en el servidor. El
    // texto dice QUÉ se sabe de la escritura (ver `run`).
    const [staleNotice, setStaleNotice] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [preview, setPreview] = useState<PropertyDocument | null>(null)

    const loadDocuments = useCallback(async () => {
        const [propertyRes, unitRes] = await Promise.all([
            propertyDocumentService.list(propertyUuid, { propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID, perPage: 100 }),
            propertyDocumentService.list(propertyUuid, { propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID, listingUuid, perPage: 100 }),
        ])
        // `meta: null` = la consulta falló y el servicio devolvió vacío: tratarlo
        // como «sin textos» haría crear duplicados.
        if (propertyRes.meta === null || unitRes.meta === null) throw new Error("documents")
        return {
            propertyDocuments: propertyRes.items.filter(isPropertyLevelDocument),
            // Defensa: solo los de ESTA unidad, aunque el filtro del backend fallara.
            unitDocuments: unitRes.items.filter((doc) => documentListingUuid(doc) === listingUuid),
        }
    }, [propertyUuid, listingUuid])

    useEffect(() => {
        let active = true
        Promise.all([loadDocuments(), reservationSourceService.list(), propertyDocumentService.getTypes()])
            .then(([documents, sources, types]) => {
                if (!active) return
                setLoaded({
                    ...documents,
                    sources,
                    shortcodes: types.find((type) => type.id === AGREEMENT_DOCUMENT_TYPE_ID)?.parameters?.shortcodes ?? [],
                })
            })
            .catch((error) => {
                console.error("[UnitContractTexts] load error:", error)
                if (active) setLoadError("No se pudieron cargar los textos de contrato de esta unidad.")
            })
        return () => { active = false }
    }, [loadDocuments])

    const unitRouting = override?.contractRouting ?? null
    const replacedTexts = unitRouting?.replacedTexts ?? []
    const plan = useMemo(() => loaded
        ? planUnitTexts({
            propertyDocuments: loaded.propertyDocuments,
            unitDocuments: loaded.unitDocuments,
            replacedUuids: new Set((unitRouting?.replacedTexts ?? []).map((text) => text.uuid)),
            routingChannels: (unitRouting ?? propertyRouting)?.channels ?? [],
            sources: loaded.sources,
        })
        : null, [loaded, unitRouting, propertyRouting])

    /**
     * Relee los textos y el override: el `contractRouting` dice qué firma cada
     * canal ahora. Si el override DEBE existir y no vuelve, la relectura está
     * incompleta: aceptarla dejaría el `contractRouting` viejo como si nada.
     */
    const refresh = async (expectOverride: boolean) => {
        const documents = await loadDocuments()
        setLoaded((previous) => previous ? { ...previous, ...documents } : previous)
        const fresh = (await automationService.listListingOverrides(listingUuid))
            .find((item) => item.propertyAutomationUuid === propertyAutomationUuid)
        if (fresh) onOverrideChanged(fresh)
        else if (expectOverride) throw new Error("El override del contrato no volvió en la relectura.")
    }

    /** `true` si releyó todo; si no, la vista puede estar vieja. */
    const tryRefresh = async (expectOverride: boolean): Promise<boolean> => {
        try {
            await refresh(expectOverride)
            return true
        } catch (error) {
            console.error("[UnitContractTexts] refresh error:", error)
            return false
        }
    }

    const retryRefresh = async () => {
        setRefreshing(true)
        if (await tryRefresh(override !== null)) setStaleNotice(null)
        setRefreshing(false)
    }

    /**
     * Una escritura de esta sección y lo que se sabe de ella después:
     *  - terminó → se guardó;
     *  - falló con 4xx → el backend no la aplicó (pero pudo quedar creado el
     *    override del paso anterior);
     *  - falló de otra forma (red, 5xx) → no se sabe si se aplicó.
     * Solo se relee si algo pudo cambiar en el servidor, y si la relectura falla
     * se dice exactamente cuál de esos casos fue.
     */
    const run = async (
        key: string,
        action: (progress: { overrideCreated: boolean }) => Promise<void>,
        success: string,
    ) => {
        const progress = { overrideCreated: false }
        setBusyKey(key)
        setRowError(null)
        let outcome: "saved" | "rejected" | "unknown" = "saved"
        try {
            await action(progress)
            toast.success(success)
            setEditing(null)
        } catch (error) {
            outcome = error instanceof ApiError && error.status >= 400 && error.status < 500 ? "rejected" : "unknown"
            setRowError({
                key,
                messages: [
                    ...validationMessages(error, "No se pudo guardar el texto de la unidad."),
                    ...(progress.overrideCreated ? ["Se activó el contrato en esta unidad, pero el texto no se guardó."] : []),
                ],
            })
        }

        if (outcome !== "rejected" || progress.overrideCreated) {
            const refreshed = await tryRefresh(override !== null || progress.overrideCreated)
            setStaleNotice(refreshed ? null : outcome === "saved"
                ? "El cambio se guardó, pero no pudimos actualizar esta vista: lo que ves puede estar desactualizado."
                : outcome === "rejected"
                    ? "Se activó el contrato en esta unidad, pero el texto no se guardó y no pudimos actualizar esta vista."
                    : "No pudimos confirmar si el cambio se guardó ni actualizar esta vista. Vuelve a cargar antes de seguir.")
        }
        setBusyKey(null)
    }

    const saveRow = (row: UnitTextRow, text: string) => run(row.key, async (progress) => {
        if (row.unitDocument) {
            await propertyDocumentService.update(propertyUuid, row.unitDocument.uuid, { content: text })
            return
        }
        // Sin override no aplica ningún texto propio: se crea activo y sin
        // parámetros, antes del texto.
        if (!override) {
            const created = await automationService.createListingOverride({
                listingUuid,
                propertyAutomationUuid,
                statusRecordId: LISTING_OVERRIDE_STATUS.ACTIVE,
                parameters: null,
            })
            progress.overrideCreated = true
            onOverrideChanged(created)
        }
        await propertyDocumentService.create(propertyUuid, {
            propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
            statusRecordId: DOCUMENT_STATUS.ACTIVE,
            listingUuid,
            ...(row.channelId != null ? { reservationSourceId: row.channelId } : {}),
            content: text,
        })
    }, "Texto de la unidad guardado")

    const removeDocument = (key: string, documentUuid: string, success: string) =>
        run(key, () => propertyDocumentService.remove(propertyUuid, documentUuid), success)

    if (loadError) {
        return (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={14} className="shrink-0" /> {loadError}
            </p>
        )
    }
    if (!loaded || !plan) {
        return (
            <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Cargando el texto del contrato…
            </div>
        )
    }

    const hasOwnTexts = loaded.unitDocuments.length > 0
    const busy = disabled || busyKey !== null || refreshing
    const routing = unitRouting ?? propertyRouting
    const allDocuments = [...loaded.unitDocuments, ...loaded.propertyDocuments]

    return (
        <section className="space-y-3" aria-labelledby="unit-contract-texts">
            <div>
                <h3 id="unit-contract-texts" className="text-sm font-bold text-slate-800">Texto del contrato de esta unidad</h3>
                <p className="text-xs text-slate-500">
                    Un texto propio reemplaza al de la propiedad solo en esta unidad. Lo que no personalices, lo hereda.
                </p>
            </div>

            {staleNotice && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span>{staleNotice}</span>
                    <Button type="button" variant="outline" size="sm" className="h-7 bg-white text-xs" disabled={refreshing} onClick={() => void retryRefresh()}>
                        <RefreshCw size={12} className={refreshing ? "mr-1 animate-spin" : "mr-1"} /> Volver a cargar
                    </Button>
                </div>
            )}

            {replacedTexts.length > 0 && (
                <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <p className="flex items-start gap-2">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>
                            {unitRouting?.replacedTextsLabel
                                || "Algunos textos propios de esta unidad ya no aplican porque la propiedad cambió cómo organiza sus textos."}
                        </span>
                    </p>
                    <p className="text-xs">Mientras sigan guardados, no se pueden crear textos nuevos en esta unidad.</p>
                    <ul className="space-y-1">
                        {replacedTexts.map((text) => (
                            <li key={text.uuid} className="flex items-center justify-between gap-2 text-xs">
                                <span>Texto propio · {text.channel.name}</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 bg-white text-xs"
                                    disabled={busy}
                                    onClick={() => void removeDocument(`replaced:${text.uuid}`, text.uuid, "Texto reemplazado borrado")}
                                >
                                    {busyKey === `replaced:${text.uuid}` && <Loader2 size={12} className="mr-1 animate-spin" />}
                                    Borrar
                                </Button>
                            </li>
                        ))}
                    </ul>
                    {rowError?.key.startsWith("replaced:") && (
                        <p role="alert" className="whitespace-pre-line text-xs text-red-700">{rowError.messages.join("\n")}</p>
                    )}
                </div>
            )}

            {plan.textMode === null ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    La propiedad todavía no tiene texto de contrato. Créalo primero en Documentos de la propiedad.
                </p>
            ) : (
                <ul className="space-y-2">
                    {plan.rows.map((row) => {
                        const source = loaded.sources.find((item) => item.id === row.channelId)
                        const isEditing = editing?.key === row.key
                        const error = rowError?.key === row.key ? rowError.messages : null
                        // Lo que la unidad FIRMA de verdad: con `contractRouting`,
                        // solo lo que dice el backend (ver `describeRowSigning`).
                        const signing = describeRowSigning(row, routing, allDocuments, listingUuid)
                        return (
                            <li key={row.key} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <ReservationSourceIdentity
                                            name={row.name}
                                            slug={row.slug ?? (source ? reservationSourceSlug(source) : null)}
                                            compact
                                        />
                                        <p className="mt-1 pl-11 text-xs font-medium text-slate-700">{signing.headline}</p>
                                        {signing.channels.map((channel) => (
                                            <p key={channel.key} className="pl-11 text-xs text-slate-500">
                                                {channel.summary || channel.channel.name}
                                                {channel.status !== "ready" && channel.statusLabel && (
                                                    <span className="block text-amber-700">{channel.statusLabel}</span>
                                                )}
                                            </p>
                                        ))}
                                    </div>
                                    {!isEditing && (
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {signing.document && (
                                                <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(signing.document)}>
                                                    <Eye size={14} className="mr-1" /> Ver texto
                                                </Button>
                                            )}
                                            {row.unitDocument && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-slate-500 hover:text-red-600"
                                                    disabled={busy}
                                                    onClick={() => void removeDocument(row.key, row.unitDocument!.uuid, "La unidad vuelve a usar el texto de la propiedad")}
                                                >
                                                    {busyKey === row.key && <Loader2 size={14} className="mr-1 animate-spin" />}
                                                    Usar el de la propiedad
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={busy || (!row.unitDocument && replacedTexts.length > 0)}
                                                onClick={() => {
                                                    setRowError(null)
                                                    setEditing({
                                                        key: row.key,
                                                        // Se parte del texto que firma hoy, para no empezar en blanco.
                                                        text: (row.unitDocument ?? row.propertyDocument)?.content ?? "",
                                                    })
                                                }}
                                            >
                                                {row.unitDocument ? "Editar texto propio" : "Usar un texto propio"}
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {isEditing && editing && (
                                    <div className="mt-3 space-y-2">
                                        <DocumentEditor
                                            value={editing.text}
                                            onChange={(text) => setEditing({ key: row.key, text })}
                                            shortcodes={loaded.shortcodes}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(null)}>
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={busy || !editing.text.replace(/<[^>]*>/g, "").trim()}
                                                onClick={() => void saveRow(row, editing.text)}
                                                className="bg-[var(--color-brand-purple)] text-white hover:bg-[var(--color-brand-purple)]/90"
                                            >
                                                {busyKey === row.key && <Loader2 size={14} className="mr-1 animate-spin" />}
                                                Guardar texto
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <p role="alert" className="mt-2 whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                                        {error.join("\n")}
                                    </p>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            {preview && (
                <DocumentPreviewModal
                    onClose={() => setPreview(null)}
                    propertyUuid={propertyUuid}
                    documentUuid={preview.uuid}
                    content={preview.content ?? ""}
                    shortcodes={loaded.shortcodes}
                    allowRealReservation={false}
                />
            )}

            {hasOwnTexts && (
                <p className="text-xs text-slate-500">
                    Si apagas el contrato en esta unidad o vuelves a heredar, sus textos propios se conservan pero dejan de aplicar.
                </p>
            )}
        </section>
    )
}
