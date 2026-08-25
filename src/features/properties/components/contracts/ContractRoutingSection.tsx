"use client"

import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { AlertCircle, AlertTriangle, FileSignature, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { catalogService } from "@/features/auth/services/catalog-service"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { propertyDocumentService } from "../../services/property-document-service"
import { reservationSourceService, type ReservationSource } from "../../services/reservation-source-service"
import { automationService } from "../../services/automation-service"
import {
    AGREEMENT_DOCUMENT_TYPE_ID,
    DOCUMENT_STATUS,
    documentChannelId,
    type PropertyDocument,
} from "../../types/document"
import { AUTOMATION_STATUS, isSignatureProvider, type Provider, type PropertyAutomation } from "../../types/automation"
import {
    ALL_SOURCES_KEY,
    parseContractRouting,
    routingForMode,
    CONTRACT_TYPE_LABELS,
    CONTRACT_TYPE_OWNERS,
    type ContractMode,
    type ContractRoutingParameters,
    type SourceRouting,
} from "../../types/contract-routing"
import { detectMode, findLockstepGaps, planDocumentSync } from "../../lib/contract-routing-sync"
import {
    buildSignatureAutomationCreatePayload,
    findSignatureAutomation,
    findSignatureProvider,
} from "../../lib/signature-automation"
import { ContractModeToggle } from "./ContractModeToggle"
import { SourceRoutingRow } from "./SourceRoutingRow"

const DEFAULT_ROUTING: SourceRouting = {
    contract_type: "agreement_only",
    provider_slug: "",
}


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
    const { watch } = useFormContext()
    const countryId: number | undefined = watch("countryId")
    const requestKey = `${propertyUuid}:${countryId ?? ""}`
    const [completedRequestKey, setCompletedRequestKey] = useState("")
    const [loadFailure, setLoadFailure] = useState<{
        key: string
        message: string
    } | null>(null)
    const loading = completedRequestKey !== requestKey
    const loadError = loadFailure?.key === requestKey ? loadFailure.message : null

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

        catalogService
            .getCountries()
            .then((countries) => {
                const country = countries.find((item) => Number(item.id) === Number(countryId))
                // El fallback a `country.iso2` (raíz) se eliminó: `getCountries()`
                // normaliza SIEMPRE a `extra.iso2` y nunca expuso ese campo en la
                // raíz, así que era una rama muerta que el `any` del catálogo
                // mantenía invisible.
                const countryIso2 = country?.extra?.iso2
                if (!countryIso2) throw new Error("No se pudo resolver el país de la propiedad.")

                return Promise.all([
                    reservationSourceService.list(),
                    automationService.listProviders({
                        statusProviderId: AUTOMATION_STATUS.ACTIVE,
                        country: countryIso2,
                    }),
                    // La lista completa y no solo la fila de firma: se identifica
                    // por `provider.parameters.signature`, nunca por
                    // executionOrder (el orden depende del país).
                    automationService.list(propertyUuid, { includeProvider: true }),
                    propertyDocumentService.list(propertyUuid, {
                        propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                        perPage: 100,
                    }),
                    propertyDocumentService.getTypes(),
                ] as const)
            })
            .then(([sourcesRes, providersRes, automationRows, docsRes, typesRes]) => {
                if (!active) return
                setLoadFailure(null)
                // A null `meta` means the documents fetch itself failed (the service
                // swallows the error and returns an empty list) — treating that as
                // "zero documents" would make the save flow create DUPLICATE rows for
                // channels that already have one. Surface it instead of guessing.
                if (docsRes.meta === null) {
                    throw new Error("No se pudieron cargar los documentos de contrato existentes.")
                }

                const signatureProviders = new Map(
                    providersRes.filter(isSignatureProvider).map((provider) => [provider.id, provider]),
                )
                setSources(sourcesRes)
                // `providerSlug` es suficiente y es la señal estable recomendada
                // por el backend. Exigir el objeto `provider` sideloaded hacía que
                // una fila existente pareciera ausente cuando la relación no venía
                // incluida o era sanitizada.
                const automationRes = findSignatureAutomation(
                    automationRows,
                    Array.from(signatureProviders.values()),
                )
                if (automationRes?.provider && isSignatureProvider(automationRes.provider)) {
                    signatureProviders.set(automationRes.provider.id, automationRes.provider)
                }
                setProviders(Array.from(signatureProviders.values()))
                setAutomation(automationRes)
                setAgreementDocs(docsRes.items)
                setShortcodes(typesRes.find((t) => t.id === AGREEMENT_DOCUMENT_TYPE_ID)?.parameters?.shortcodes ?? [])

                const parsed = parseContractRouting(automationRes?.parameters)
                const initialMode = parsed?.contract_mode ?? detectMode(docsRes.items) ?? "all_sources"
                const allowedSourceIds = new Set(sourcesRes.map((source) => source.id))
                const initialRouting = routingForMode(initialMode, parsed?.by_source ?? {}, allowedSourceIds)
                setMode(initialMode)
                setBySource(initialRouting)

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
                if (active) {
                    setLoadFailure({
                        key: requestKey,
                        message: "No se pudo cargar la configuración de contrato y firma.",
                    })
                }
            })
            .finally(() => {
                if (active) setCompletedRequestKey(requestKey)
            })

        return () => {
            active = false
        }
    }, [propertyUuid, countryId, requestKey])

    // ── Mode switch ──────────────────────────────────────────────────────────

    const handleModeChange = (next: ContractMode) => {
        setMode(next)
        // Reset to a single clean slot for the new mode instead of carrying over
        // keys that don't make sense in it (a numeric source id in all_sources
        // mode, or "all" in per_source mode) — the PM reconfigures explicitly.
        if (next === "all_sources") {
            setBySource({
                [ALL_SOURCES_KEY]: bySource[ALL_SOURCES_KEY] ?? DEFAULT_ROUTING,
            })
        } else {
            const rest = { ...bySource }
            delete rest[ALL_SOURCES_KEY]
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
        setBySource((prev) => ({
            ...prev,
            [String(sourceId)]: DEFAULT_ROUTING,
        }))
        setSaveError(null)
    }
    const removeChannel = (key: string) => {
        setBySource((prev) => {
            const rest = { ...prev }
            delete rest[key]
            return rest
        })
        setTexts((prev) => {
            const rest = { ...prev }
            delete rest[key]
            return rest
        })
        setSaveError(null)
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    const desired: ContractRoutingParameters = {
        contract_mode: mode,
        by_source: routingForMode(mode, bySource, new Set(sources.map((source) => source.id))),
    }
    const gaps = findLockstepGaps(desired, texts)

    // Esta pantalla puede VERSE configurada sin routing persistido: al cargar,
    // el modo y los textos se infieren de los property_documents cuando la
    // automatización no tiene `contract_mode`/`by_source` guardados. Esa
    // inferencia es un buen prellenado, pero presentarla sin aviso hacía que
    // Documentos y la tarjeta de Contrato se contradijeran ("configurado" acá,
    // "Sin configurar" allá). Derivado, no estado: guardar actualiza
    // `automation` y el aviso desaparece solo.
    const routingPersistedInAutomation = parseContractRouting(automation?.parameters) !== null
    const showsUnsavedInference = !routingPersistedInAutomation && agreementDocs.length > 0

    const handleSave = async () => {
        if (Object.keys(desired.by_source).length === 0) {
            setSaveError("Configura al menos un canal antes de guardar.")
            return
        }
        if (gaps.length > 0) {
            setSaveError("Completa el texto de contrato de los canales marcados antes de guardar.")
            return
        }
        if (Object.values(desired.by_source).some((r) => !r.provider_slug)) {
            setSaveError("Selecciona el proveedor de firma de cada canal antes de guardar.")
            return
        }
        const selectedProviderSlugs = new Set(
            Object.values(desired.by_source).map((routing) => routing.provider_slug),
        )
        const unresolvedProvider = Array.from(selectedProviderSlugs).find(
            (providerSlug) => !findSignatureProvider(providers, providerSlug),
        )
        if (unresolvedProvider) {
            setSaveError("No se pudo resolver el proveedor de firma seleccionado. Recarga la página e intenta nuevamente.")
            return
        }
        // El tracker distingue la FILA de automatización de quien firma cada
        // canal: existe una sola PropertyAutomation estructural, cuyo provider es
        // hitguest_signature. TuFirma se selecciona únicamente dentro de
        // by_source[].provider_slug; no crea una segunda fila de automatización.
        const structuralProvider = findSignatureProvider(providers, "hitguest_signature")
        if (!structuralProvider) {
            setSaveError("HIT Guest Signature no está disponible para esta propiedad. Recarga la página e intenta nuevamente.")
            return
        }

        setSaving(true)
        setSaveError(null)
        let routingPersisted = false
        try {
            // 0. Si falta la fila estructural, el PM la crea INACTIVA. Crear no
            // equivale a activar: `/configure` es el endpoint que valida el
            // routing contra los documentos ya sincronizados.
            let target = automation
            if (!target) {
                target = await automationService.create(
                    buildSignatureAutomationCreatePayload(propertyUuid, structuralProvider),
                )
                setAutomation(target)
            }

            // 1. property_documents first — configure() validates against their
            //    live state at call time, not against what we're about to send (§1.4).
            const plan = planDocumentSync(agreementDocs, desired, texts)
            // Execute deterministically. A conversion update must happen before
            // creating the remaining channel rows; deletes run last so a transient
            // failure does not remove more legal text than necessary. This cannot
            // make independent backend endpoints transactional, but it makes the
            // partial state predictable and therefore reconcilable.
            for (const update of plan.updates) {
                await propertyDocumentService.update(propertyUuid, update.documentUuid, {
                    ...(update.reservationSourceId !== undefined ? { reservationSourceId: update.reservationSourceId } : {}),
                    ...(update.content !== undefined ? { content: update.content } : {}),
                })
            }
            for (const create of plan.creates) {
                await propertyDocumentService.create(propertyUuid, {
                        propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                        statusRecordId: DOCUMENT_STATUS.ACTIVE,
                        reservationSourceId: create.reservationSourceId,
                        content: create.content,
                })
            }
            for (const documentUuid of plan.deletes) {
                await propertyDocumentService.remove(propertyUuid, documentUuid)
            }

            // 2. Only now configure the automation with the final routing.
            //    `parameters` is typed `Record<string, unknown>` on the payload —
            //    ContractRoutingParameters is a plain object whose values are all
            //    assignable to `unknown`, just not structurally an index signature.
            const routingParameters = desired as unknown as Record<string, unknown>
            // El PM puede crear, activar y desactivar automatizaciones. Si esta
            // propiedad todavía no tiene la fila de firma, el mismo guardado la
            // crea con el proveedor seleccionado; no necesita intervención de HIT.
            // `provider_id` de la fila satisface el contrato de creación, mientras
            // que el routing efectivo por canal vive en by_source.provider_slug.
            const result = await automationService.configure(target.uuid, {
                statusProviderId: AUTOMATION_STATUS.ACTIVE,
                // Mantiene una sola fila estructural aunque el routing seleccione
                // TuFirma para uno o más canales.
                providerId: structuralProvider.id,
                parameters: routingParameters,
            })
            routingPersisted = true
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
            // Every write above is an independent request. Always reconcile after
            // a failure so a retry plans from server truth instead of stale UUIDs
            // and cannot duplicate documents that were already created.
            try {
                const [refreshedDocs, refreshedAutomations] = await Promise.all([
                    propertyDocumentService.list(propertyUuid, {
                        propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                        perPage: 100,
                    }),
                    automationService.list(propertyUuid, { includeProvider: true }),
                ])
                setAgreementDocs(refreshedDocs.items)
                setAutomation(findSignatureAutomation(refreshedAutomations, providers))

                // `configure()` already committed and only the final refresh failed.
                // The requested routing is live; reporting the whole save as failed
                // would invite a destructive duplicate retry.
                if (routingPersisted) {
                    toast.success("Contrato y firma guardados")
                    return
                }
            } catch (reconcileError) {
                console.error("[ContractRoutingSection] reconciliation error:", reconcileError)
            }
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
                        <p className="text-sm text-slate-500">Qué se firma y con quién, por canal de reserva.</p>
                    </div>
                </div>
                <ContractModeToggle value={mode} onChange={handleModeChange} disabled={saving} />
            </div>

            {showsUnsavedInference && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>
                        Hay textos de contrato guardados, pero la automatización de Contrato
                        todavía no tiene guardado qué se firma ni quién firma por canal — las
                        reservas no generan contrato hasta que guardes esta configuración.
                    </p>
                </div>
            )}

            {Object.keys(desired.by_source).length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold text-[var(--color-brand-purple)]">
                        {routingPersistedInAutomation ? "Configuración activa:" : "Configuración sin guardar:"}
                    </span>
                    <span>
                        {mode === "all_sources"
                            ? "Un contrato para todos los canales"
                            : "Un contrato distinto por canal"}
                    </span>
                    {mode === "all_sources" && desired.by_source[ALL_SOURCES_KEY] && (
                        <span className="text-slate-500">
                            · {CONTRACT_TYPE_LABELS[desired.by_source[ALL_SOURCES_KEY].contract_type]} (
                            {CONTRACT_TYPE_OWNERS[desired.by_source[ALL_SOURCES_KEY].contract_type]})
                        </span>
                    )}
                </div>
            )}

            {mode === "all_sources" ? (
                <SourceRoutingRow
                    sourceLabel="Todos los canales"
                    routing={bySource[ALL_SOURCES_KEY] ?? DEFAULT_ROUTING}
                    onChange={(r) => {
                        setBySource({ [ALL_SOURCES_KEY]: r })
                        setSaveError(null)
                    }}
                    providers={providers}
                    text={texts[ALL_SOURCES_KEY] ?? ""}
                    onTextChange={(t) => {
                        setTexts((prev) => ({ ...prev, [ALL_SOURCES_KEY]: t }))
                        setSaveError(null)
                    }}
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
                            onChange={(r) => {
                                setBySource((prev) => ({ ...prev, [key]: r }))
                                setSaveError(null)
                            }}
                            providers={providers}
                            text={texts[key] ?? ""}
                            onTextChange={(t) => {
                                setTexts((prev) => ({ ...prev, [key]: t }))
                                setSaveError(null)
                            }}
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

            {mode === "per_source" && availableToAdd.length > 0 && (
                <div className="flex items-start gap-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Canales sin contrato configurado</p>
                        <p className="mt-0.5">
                            Las reservas de {availableToAdd.map((s) => s.name).join(", ")} no podrán firmar contrato. Si
                            es intencional, puedes ignorar este aviso.
                        </p>
                    </div>
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
