"use client"

import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { AlertCircle, AlertTriangle, CheckCircle2, FileSignature, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { ApiError } from "@/types/api"
import { catalogService } from "@/features/auth/services/catalog-service"
import { Button } from "@/components/ui/button"
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
    orphanRoutingEntries,
    parseContractRouting,
    routingForMode,
    CONTRACT_TYPE_LABELS,
    requiresAgreementDocument,
    type ContractMode,
    type ContractRoutingParameters,
    type SourceRouting,
} from "../../types/contract-routing"
import { detectMode, findLockstepGaps, isSaveConfirmed, planDocumentSync } from "../../lib/contract-routing-sync"
import {
    buildSignatureAutomationCreatePayload,
    findSignatureAutomation,
    findSignatureProvider,
} from "../../lib/signature-automation"
import { ContractModeToggle } from "./ContractModeToggle"
import { SourceRoutingRow } from "./SourceRoutingRow"
import { ContractChannelCard, type ContractChannelStatus } from "./ContractChannelCard"

const DEFAULT_ROUTING: SourceRouting = {
    contract_type: "agreement_only",
    provider_slug: "",
}

function comparableRouting(routing: Record<string, SourceRouting>): Record<string, SourceRouting> {
    return Object.fromEntries(Object.entries(routing).sort(([left], [right]) => left.localeCompare(right)))
}

function draftFingerprint(
    mode: ContractMode,
    routing: Record<string, SourceRouting>,
    texts: Record<string, string>,
): string {
    const normalizedRouting = comparableRouting(routingForMode(mode, routing))
    return JSON.stringify({
        mode,
        routing: normalizedRouting,
        texts: Object.fromEntries(Object.keys(normalizedRouting).map((key) => [key, texts[key] ?? ""])),
    })
}

function textsByDocumentChannel(documents: PropertyDocument[]): Record<string, string> {
    const result: Record<string, string> = {}
    for (const document of documents) {
        const channelId = documentChannelId(document)
        result[channelId == null ? ALL_SOURCES_KEY : String(channelId)] = document.content ?? ""
    }
    return result
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
    // Routing guardado bajo ids que el catálogo no reconoce. No se puede editar
    // acá (el payload nunca los reenvía), pero tampoco se calla: ver
    // `orphanRoutingEntries`.
    const [orphanRouting, setOrphanRouting] = useState<Array<{ sourceKey: string; routing: SourceRouting }>>([])

    const [providers, setProviders] = useState<Provider[]>([])
    const [automation, setAutomation] = useState<PropertyAutomation | null>(null)
    const [agreementDocs, setAgreementDocs] = useState<PropertyDocument[]>([])
    const [shortcodes, setShortcodes] = useState<string[]>([])

    const [mode, setMode] = useState<ContractMode>("all_sources")
    const [bySource, setBySource] = useState<Record<string, SourceRouting>>({})
    const [texts, setTexts] = useState<Record<string, string>>({})
    const [persistedMode, setPersistedMode] = useState<ContractMode>("all_sources")
    const [persistedBySource, setPersistedBySource] = useState<Record<string, SourceRouting>>({})
    const [persistedTexts, setPersistedTexts] = useState<Record<string, string>>({})
    const [expandedChannel, setExpandedChannel] = useState<string | null>(null)

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
                setPersistedMode(initialMode)
                setPersistedBySource(initialRouting)
                setOrphanRouting(orphanRoutingEntries(parsed?.by_source, allowedSourceIds))

                const initialTexts = textsByDocumentChannel(docsRes.items)
                setTexts(initialTexts)
                setPersistedTexts(initialTexts)
                setExpandedChannel(null)
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
        setExpandedChannel(null)
        setSaveError(null)
    }

    // ── Per-channel edits (per_source mode) ─────────────────────────────────

    const addChannel = (sourceId: number) => {
        setBySource((prev) => ({
            ...prev,
            [String(sourceId)]: DEFAULT_ROUTING,
        }))
        setExpandedChannel(String(sourceId))
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
        setExpandedChannel((current) => current === key ? null : current)
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

    /**
     * Configuración guardada bajo claves que no son canales (p. ej. «0, 1, 2»,
     * skill de contratos 2026-10-18): se perdió la relación con el canal
     * original. Editar y guardar desde acá reemplazaría ese routing con lo que
     * el PM crea que corresponde — asignar un contrato al canal equivocado.
     * Hasta que soporte lo corrija, la edición queda bloqueada.
     */
    const routingBlocked = orphanRouting.length > 0
    const currentFingerprint = draftFingerprint(mode, desired.by_source, texts)
    const persistedFingerprint = draftFingerprint(persistedMode, persistedBySource, persistedTexts)
    const hasUnsavedChanges = currentFingerprint !== persistedFingerprint || showsUnsavedInference

    const channelIsDirty = (key: string): boolean => {
        if (mode !== persistedMode) return true
        return JSON.stringify(bySource[key] ?? null) !== JSON.stringify(persistedBySource[key] ?? null)
            || (texts[key] ?? "") !== (persistedTexts[key] ?? "")
    }

    const channelStatus = (key: string, routing: SourceRouting | undefined): ContractChannelStatus => {
        if (channelIsDirty(key)) return "dirty"
        if (!routing) return "unconfigured"
        if (!routing.provider_slug || (requiresAgreementDocument(routing.contract_type) && !texts[key]?.trim())) return "incomplete"
        return "configured"
    }

    const channelSummary = (routing: SourceRouting | undefined, key: string): string => {
        if (!routing) {
            return persistedBySource[key]
                ? "Esta configuración se quitará cuando guardes los cambios."
                : "Las reservas de este canal no firman contrato."
        }
        if (!routing.provider_slug) return "Completa la configuración y elige quién firma."
        const provider = findSignatureProvider(providers, routing.provider_slug)
        return `${CONTRACT_TYPE_LABELS[routing.contract_type]} · Firma: ${provider?.name ?? routing.provider_slug}`
    }

    /**
     * Rehidrata exclusivamente con lo que confirmó el servidor. El toast de éxito
     * depende de esta comparación: un `by_source` reindexado como 0/1/2 nunca se
     * anuncia como guardado aunque el PATCH haya respondido 200.
     */
    const applyConfirmedState = (row: PropertyAutomation | null, documents: PropertyDocument[]): boolean => {
        const allowedSourceIds = new Set(sources.map((source) => source.id))
        const parsed = parseContractRouting(row?.parameters)
        const confirmedOrphans = orphanRoutingEntries(parsed?.by_source, allowedSourceIds)
        const confirmedMode = parsed?.contract_mode ?? detectMode(documents) ?? "all_sources"
        const confirmedRouting = routingForMode(confirmedMode, parsed?.by_source ?? {}, allowedSourceIds)
        const confirmedTexts = textsByDocumentChannel(documents)

        setAutomation(row)
        setAgreementDocs(documents)
        setOrphanRouting(confirmedOrphans)
        setMode(confirmedMode)
        setBySource(confirmedRouting)
        setTexts(confirmedTexts)
        setPersistedMode(confirmedMode)
        setPersistedBySource(confirmedRouting)
        setPersistedTexts(confirmedTexts)
        setExpandedChannel(null)

        if (!parsed || confirmedOrphans.length > 0) {
            setSaveError("El servidor no devolvió una configuración de canales válida. No se confirmó el guardado.")
            return false
        }

        const confirmedOk = isSaveConfirmed(
            { contract_mode: mode, by_source: routingForMode(mode, desired.by_source) },
            { contract_mode: confirmedMode, by_source: confirmedRouting },
            new Set(Object.keys(confirmedTexts)),
        )
        if (!confirmedOk) {
            setSaveError("El servidor devolvió una configuración diferente a la enviada. Recarga antes de intentar nuevamente.")
            return false
        }
        return true
    }

    const handleSave = async () => {
        if (routingBlocked) return
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
            await automationService.configure(target.uuid, {
                statusProviderId: AUTOMATION_STATUS.ACTIVE,
                // Mantiene una sola fila estructural aunque el routing seleccione
                // TuFirma para uno o más canales.
                providerId: structuralProvider.id,
                parameters: routingParameters,
            })
            routingPersisted = true

            // Un GET nuevo, no solo la respuesta del PATCH: este es exactamente el
            // estado que verá el PM la próxima vez que abra Documentos.
            const [refreshedDocs, confirmedAutomation] = await Promise.all([
                propertyDocumentService.list(propertyUuid, {
                    propertyDocumentTypeId: AGREEMENT_DOCUMENT_TYPE_ID,
                    perPage: 100,
                }),
                automationService.show(target.uuid, { includeProvider: true }),
            ])
            if (applyConfirmedState(confirmedAutomation, refreshedDocs.items)) {
                toast.success("Contrato y firma guardados")
            }
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
                const reconciled = findSignatureAutomation(refreshedAutomations, providers)
                const confirmed = applyConfirmedState(reconciled, refreshedDocs.items)

                if (routingPersisted && confirmed) {
                    toast.success("Contrato y firma guardados")
                    return
                }
            } catch (reconcileError) {
                console.error("[ContractRoutingSection] reconciliation error:", reconcileError)
            }
            if (routingPersisted) {
                setSaveError("El servidor recibió el guardado, pero no pudimos confirmar cómo quedó. Recarga la página antes de volver a intentarlo.")
            } else if (err instanceof ApiError && err.status === 422) {
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
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--color-brand-purple)]/10 p-2.5">
                    <FileSignature className="h-6 w-6 text-[var(--color-brand-purple)]" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Contratos por canal</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        Define qué documento reciben y cómo firman los huéspedes según el origen de la reserva.
                    </p>
                </div>
            </div>

            {routingBlocked && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div className="space-y-1.5">
                        <p className="font-semibold">No pudimos identificar los canales de la configuración guardada.</p>
                        <p>
                            Para evitar asignar un contrato al canal equivocado, la edición está bloqueada
                            temporalmente. Contacta a soporte para corregir la configuración.
                        </p>
                        <details className="text-xs text-amber-800">
                            <summary className="cursor-pointer font-medium">Información técnica</summary>
                            <ul className="mt-1 space-y-0.5">
                                {orphanRouting.map(({ sourceKey, routing }) => (
                                    <li key={sourceKey}>
                                        Clave guardada «{sourceKey}» · {CONTRACT_TYPE_LABELS[routing.contract_type]} ·{" "}
                                        {findSignatureProvider(providers, routing.provider_slug)?.name ?? routing.provider_slug}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1">
                                Ninguna de estas claves es el id de un canal del catálogo de canales de reserva
                                (`by_source` de la automatización de Contrato).
                            </p>
                        </details>
                    </div>
                </div>
            )}

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

            <section className="space-y-2" aria-labelledby="contract-mode-heading">
                <div>
                    <h4 id="contract-mode-heading" className="text-sm font-bold text-slate-800">¿Cómo quieres aplicar tus contratos?</h4>
                    <p className="mt-0.5 text-xs text-slate-500">Puedes usar una sola configuración o personalizarla para cada canal.</p>
                </div>
                <ContractModeToggle value={mode} onChange={handleModeChange} disabled={saving || routingBlocked} />
            </section>

            {/* `inert`: bloquea también el editor de texto (contenteditable), que un
                `fieldset disabled` no alcanza. */}
            <div inert={routingBlocked || undefined} aria-disabled={routingBlocked || undefined} className={routingBlocked ? "space-y-4 opacity-60" : "space-y-4"}>
            {mode === "all_sources" ? (
                <ContractChannelCard
                    fallbackName="Todos los canales"
                    status={channelStatus(ALL_SOURCES_KEY, bySource[ALL_SOURCES_KEY])}
                    summary={channelSummary(bySource[ALL_SOURCES_KEY], ALL_SOURCES_KEY)}
                    expanded={expandedChannel === ALL_SOURCES_KEY}
                    onToggle={() => {
                        if (!bySource[ALL_SOURCES_KEY]) setBySource({ [ALL_SOURCES_KEY]: DEFAULT_ROUTING })
                        setExpandedChannel((current) => current === ALL_SOURCES_KEY ? null : ALL_SOURCES_KEY)
                        setSaveError(null)
                    }}
                >
                    {bySource[ALL_SOURCES_KEY] && (
                        <SourceRoutingRow
                            routing={bySource[ALL_SOURCES_KEY]}
                            onChange={(routing) => {
                                setBySource({ [ALL_SOURCES_KEY]: routing })
                                setSaveError(null)
                            }}
                            providers={providers}
                            text={texts[ALL_SOURCES_KEY] ?? ""}
                            onTextChange={(text) => {
                                setTexts((previous) => ({ ...previous, [ALL_SOURCES_KEY]: text }))
                                setSaveError(null)
                            }}
                            shortcodes={shortcodes}
                            hasTextGap={gaps.includes(ALL_SOURCES_KEY)}
                        />
                    )}
                </ContractChannelCard>
            ) : (
                <div className="space-y-3" aria-label="Configuración por canal">
                    {sources.map((source) => {
                        const key = String(source.id)
                        const routing = bySource[key]
                        return (
                            <ContractChannelCard
                                key={key}
                                source={source}
                                status={channelStatus(key, routing)}
                                summary={channelSummary(routing, key)}
                                expanded={expandedChannel === key}
                                onToggle={() => {
                                    if (!routing) addChannel(source.id)
                                    else setExpandedChannel((current) => current === key ? null : key)
                                    setSaveError(null)
                                }}
                                onRemove={routing ? () => removeChannel(key) : undefined}
                            >
                                {routing && (
                                    <SourceRoutingRow
                                        routing={routing}
                                        onChange={(next) => {
                                            setBySource((previous) => ({ ...previous, [key]: next }))
                                            setSaveError(null)
                                        }}
                                        providers={providers}
                                        text={texts[key] ?? ""}
                                        onTextChange={(text) => {
                                            setTexts((previous) => ({ ...previous, [key]: text }))
                                            setSaveError(null)
                                        }}
                                        shortcodes={shortcodes}
                                        hasTextGap={gaps.includes(key)}
                                    />
                                )}
                            </ContractChannelCard>
                        )
                    })}
                </div>
            )}
            </div>

            {saveError && (
                <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="shrink-0" /> {saveError}
                </p>
            )}

            <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm">
                    {routingBlocked ? (
                        <><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="font-semibold text-amber-800">Edición bloqueada hasta corregir los canales no identificados.</span></>
                    ) : hasUnsavedChanges ? (
                        <><AlertCircle className="h-4 w-4 text-amber-600" /><span className="font-semibold text-amber-800">Tienes cambios sin guardar.</span></>
                    ) : (
                        <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="font-semibold text-emerald-700">La configuración está guardada.</span></>
                    )}
                </div>
                <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || routingBlocked || !hasUnsavedChanges}
                    className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold"
                >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar contrato y firma
                </Button>
            </div>
        </div>
    )
}
