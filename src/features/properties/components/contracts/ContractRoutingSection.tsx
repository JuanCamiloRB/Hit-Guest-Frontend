"use client"

import { useEffect, useState } from "react"
import { AlertCircle, FileSignature, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { propertyDocumentService } from "../../services/property-document-service"
import { reservationSourceService, type ReservationSource } from "../../services/reservation-source-service"
import { automationService } from "../../services/automation-service"
import {
    AGREEMENT_DOCUMENT_TYPE_ID,
    DOCUMENT_STATUS,
    documentChannelId,
    type PropertyDocument,
} from "../../types/document"
import {
    AUTOMATION_ORDERS,
    AUTOMATION_STATUS,
    isSignatureProvider,
    type Provider,
    type PropertyAutomation,
} from "../../types/automation"
import {
    ALL_SOURCES_KEY,
    parseContractRouting,
    type ContractMode,
    type ContractRoutingParameters,
    type SourceRouting,
} from "../../types/contract-routing"
import { detectMode, findLockstepGaps, planDocumentSync } from "../../lib/contract-routing-sync"
import { ContractModeToggle } from "./ContractModeToggle"
import { SourceRoutingRow } from "./SourceRoutingRow"

const DEFAULT_ROUTING: SourceRouting = { contract_type: "agreement_only", provider_slug: "" }

interface Props {
    propertyUuid: string
}

/**
 * The one screen that configures contract text + signature routing for a
 * property (backend plan §3.6) — replaces what used to be split across the
 * generic document form (channel + signature) and the automation card's
 * provider picker. Owns the full save sequence from §3.5: sync
 * property_documents first, THEN configure() the automation, never the
 * other way — configure() validates against the live state of
 * property_documents at call time.
 */
export function ContractRoutingSection({ propertyUuid }: Props) {
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [sources, setSources] = useState<ReservationSource[]>([])
    const [providers, setProviders] = useState<Provider[]>([])
    const [automation, setAutomation] = useState<PropertyAutomation | null>(null)
    const [agreementDocs, setAgreementDocs] = useState<PropertyDocument[]>([])
    const [shortcodes, setShortcodes] = useState<string[]>([])

    const [mode, setMode] = useState<ContractMode>("all_sources")
    const [bySource, setBySource] = useState<Record<string, SourceRouting>>({})
    const [texts, setTexts] = useState<Record<string, string>>({})

    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        setLoading(true)
        setLoadError(null)

        Promise.all([
            reservationSourceService.list(),
            automationService.listProviders({ statusProviderId: AUTOMATION_STATUS.ACTIVE }),
            automationService.getContractRoutingAutomation(propertyUuid),
            propertyDocumentService.list(propertyUuid, {
                propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                perPage: 100,
            }),
            propertyDocumentService.getTypes(),
        ])
            .then(([sourcesRes, providersRes, automationRes, docsRes, typesRes]) => {
                if (!active) return
                // A null `meta` means the documents fetch itself failed (the service
                // swallows the error and returns an empty list) — treating that as
                // "zero documents" would make the save flow create DUPLICATE rows for
                // channels that already have one. Surface it instead of guessing.
                if (docsRes.meta === null) {
                    throw new Error("No se pudieron cargar los documentos de contrato existentes.")
                }

                setSources(sourcesRes)
                setProviders(providersRes.filter(isSignatureProvider))
                setAutomation(automationRes)
                setAgreementDocs(docsRes.items)
                setShortcodes(
                    typesRes.find((t) => t.id === AGREEMENT_DOCUMENT_TYPE_ID)?.parameters?.shortcodes ?? [],
                )

                const parsed = parseContractRouting(automationRes?.parameters)
                const initialMode = parsed?.contract_mode ?? detectMode(docsRes.items) ?? "all_sources"
                setMode(initialMode)
                setBySource(parsed?.by_source ?? {})

                const initialTexts: Record<string, string> = {}
                for (const doc of docsRes.items) {
                    const channelId = documentChannelId(doc)
                    const key = channelId == null ? ALL_SOURCES_KEY : String(channelId)
                    initialTexts[key] = doc.content ?? ""
                }
                setTexts(initialTexts)
            })
            .catch((err) => {
                console.error("[ContractRoutingSection] load error:", err)
                if (active) setLoadError("No se pudo cargar la configuración de contrato y firma.")
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => { active = false }
    }, [propertyUuid])

    // ── Mode switch ──────────────────────────────────────────────────────────

    const handleModeChange = (next: ContractMode) => {
        setMode(next)
        // Reset to a single clean slot for the new mode instead of carrying over
        // keys that don't make sense in it (a numeric source id in all_sources
        // mode, or "all" in per_source mode) — the PM reconfigures explicitly.
        if (next === "all_sources") {
            setBySource({ [ALL_SOURCES_KEY]: bySource[ALL_SOURCES_KEY] ?? DEFAULT_ROUTING })
        } else {
            const { [ALL_SOURCES_KEY]: _all, ...rest } = bySource
            setBySource(rest)
        }
        setSaveError(null)
    }

    // ── Per-channel edits (per_source mode) ─────────────────────────────────

    const configuredSourceIds = Object.keys(bySource)
        .filter((k) => k !== ALL_SOURCES_KEY)
        .map(Number)
    const availableToAdd = sources.filter((s) => !configuredSourceIds.includes(s.id))

    const addChannel = (sourceId: number) => {
        setBySource((prev) => ({ ...prev, [String(sourceId)]: DEFAULT_ROUTING }))
    }
    const removeChannel = (key: string) => {
        setBySource((prev) => {
            const { [key]: _removed, ...rest } = prev
            return rest
        })
        setTexts((prev) => {
            const { [key]: _removed, ...rest } = prev
            return rest
        })
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    const desired: ContractRoutingParameters = { contract_mode: mode, by_source: bySource }
    const gaps = findLockstepGaps(desired, texts)

    const handleSave = async () => {
        if (Object.keys(bySource).length === 0) {
            setSaveError("Configura al menos un canal antes de guardar.")
            return
        }
        if (gaps.length > 0) {
            setSaveError("Completa el texto de contrato de los canales marcados antes de guardar.")
            return
        }
        if (Object.values(bySource).some((r) => !r.provider_slug)) {
            setSaveError("Selecciona el proveedor de firma de cada canal antes de guardar.")
            return
        }

        setSaving(true)
        setSaveError(null)
        try {
            // 1. property_documents first — configure() validates against their
            //    live state at call time, not against what we're about to send (§1.4).
            const plan = planDocumentSync(agreementDocs, desired, texts)
            await Promise.all([
                ...plan.creates.map((c) =>
                    propertyDocumentService.create(propertyUuid, {
                        propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                        statusRecordId: DOCUMENT_STATUS.ACTIVE,
                        reservationSourceId: c.reservationSourceId,
                        content: c.content,
                    }),
                ),
                ...plan.updates.map((u) =>
                    propertyDocumentService.update(propertyUuid, u.documentUuid, {
                        ...(u.reservationSourceId !== undefined
                            ? { reservationSourceId: u.reservationSourceId }
                            : {}),
                        ...(u.content !== undefined ? { content: u.content } : {}),
                    }),
                ),
                ...plan.deletes.map((uuid) => propertyDocumentService.remove(propertyUuid, uuid)),
            ])

            // 2. Only now configure the automation with the final routing.
            //    `parameters` is typed `Record<string, unknown>` on the payload —
            //    ContractRoutingParameters is a plain object whose values are all
            //    assignable to `unknown`, just not structurally an index signature.
            const routingParameters = desired as unknown as Record<string, unknown>
            const result = automation
                ? await automationService.configure(automation.uuid, {
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                    parameters: routingParameters,
                })
                : await automationService.create({
                    propertyUuid,
                    name: "Firma Digital",
                    guestType: "main_guest",
                    executionOrder: AUTOMATION_ORDERS.DIGITAL_CONTRACT,
                    parameters: routingParameters,
                    statusProviderId: AUTOMATION_STATUS.ACTIVE,
                })
            setAutomation(result)

            // Refresh from the server so the next edit starts from real uuids
            // (created rows) instead of the plan's local guesses.
            const refreshed = await propertyDocumentService.list(propertyUuid, {
                propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                perPage: 100,
            })
            setAgreementDocs(refreshed.items)

            toast.success("Contrato y firma guardados")
        } catch (err) {
            if (err instanceof ApiError && err.status === 422) {
                const errors = err.errors
                const first = Array.isArray(errors)
                    ? errors.flatMap((e) => (typeof e === "string" ? [e] : Object.values(e).flat()))[0]
                    : undefined
                setSaveError(first || err.message || "Revisa la configuración de contrato y firma.")
            } else {
                notifyError(err, "Error al guardar el contrato y la firma")
            }
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Cargando contrato y firma…</span>
            </div>
        )
    }

    if (loadError) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{loadError}</p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-[var(--color-brand-purple)]/10 rounded-lg">
                        <FileSignature className="h-5 w-5 text-[var(--color-brand-purple)]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Contrato y firma</h3>
                        <p className="text-sm text-slate-500">
                            Qué se firma y con quién, por canal de reserva.
                        </p>
                    </div>
                </div>
                <ContractModeToggle value={mode} onChange={handleModeChange} disabled={saving} />
            </div>

            {mode === "all_sources" ? (
                <SourceRoutingRow
                    sourceLabel="Todos los canales"
                    routing={bySource[ALL_SOURCES_KEY] ?? DEFAULT_ROUTING}
                    onChange={(r) => setBySource({ [ALL_SOURCES_KEY]: r })}
                    providers={providers}
                    text={texts[ALL_SOURCES_KEY] ?? ""}
                    onTextChange={(t) => setTexts((prev) => ({ ...prev, [ALL_SOURCES_KEY]: t }))}
                    shortcodes={shortcodes}
                    hasTextGap={gaps.includes(ALL_SOURCES_KEY)}
                />
            ) : (
                <div className="space-y-3">
                    {Object.entries(bySource).map(([key, routing]) => (
                        <SourceRoutingRow
                            key={key}
                            sourceLabel={sources.find((s) => s.id === Number(key))?.name ?? `Canal ${key}`}
                            routing={routing}
                            onChange={(r) => setBySource((prev) => ({ ...prev, [key]: r }))}
                            providers={providers}
                            text={texts[key] ?? ""}
                            onTextChange={(t) => setTexts((prev) => ({ ...prev, [key]: t }))}
                            shortcodes={shortcodes}
                            hasTextGap={gaps.includes(key)}
                            onRemove={() => removeChannel(key)}
                        />
                    ))}

                    {availableToAdd.length > 0 && (
                        <Select onValueChange={(v) => addChannel(Number(v))}>
                            <SelectTrigger className="w-full sm:w-64 bg-slate-50 border-dashed border-slate-300 text-slate-500">
                                <Plus size={14} className="mr-1" />
                                <SelectValue placeholder="Agregar canal" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableToAdd.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            {saveError && (
                <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="shrink-0" /> {saveError}
                </p>
            )}

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold"
                >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar contrato y firma
                </Button>
            </div>
        </div>
    )
}
