"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Building2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Note } from "@/components/ui/note"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SwitchField } from "@/components/ui/switch-field"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fieldErrorMessage, getErrorMessage } from "@/lib/notify-error"
import { automationService } from "../../services/automation-service"
import { getOverrideFieldSchema, isOverridableSlug } from "../../data/automation-definitions"
import {
    LISTING_OVERRIDE_STATUS,
    isSignatureProvider,
    type ListingAutomationOverride,
    type PropertyAutomation,
} from "../../types/automation"
import { ParameterField } from "./ParameterField"
import { IdentityOverrideSelector } from "./IdentityOverrideSelector"
import { UnitContractTexts } from "../contracts/UnitContractTexts"
import { automationTitle } from "../../lib/automation-display"
import { useIdentityProviderCatalog } from "../../hooks/useIdentityProviderCatalog"
import {
    IdentityProviderUnavailableError,
    draftIdentityOverride,
    inheritDescription,
    isIdentityPropertyAutomation,
    planIdentityOverrideWrite,
    propertySlotCanBeOverridden,
    readIdentityOverrideState,
    type IdentityChoice,
    type OverrideOperation,
} from "../../lib/identity-listing-override"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import {
    LISTING_CREDENTIALS_COPY,
    listingCredentialState,
    readCredentialsScope,
    requiredListingCredentialKeys,
} from "../../lib/credentials-scope"

/** Minimal listing info needed to identify and label a unit. */
export interface ListingMeta {
    uuid: string
    name: string
    internalName?: string | null
}

interface Props {
    open: boolean
    onClose: () => void
    listingUuid: string
    listingName?: string
    /** Property automations of the parent property (used for the create dropdown + provider info). */
    propertyAutomations: PropertyAutomation[]
    /** Edit mode when set; otherwise create mode. */
    override?: ListingAutomationOverride | null
    /** propertyAutomation UUIDs already overridden (excluded from the create dropdown). */
    existingOverridePAUuids?: string[]
    /** Create mode: pin the automation and hide the dropdown (used by the per-automation panel). */
    lockedPropertyAutomationUuid?: string
    /**
     * Draft mode: don't call the API on save (e.g. the listing doesn't exist yet).
     * Returns a synthesized override via onSaved; the caller persists it later.
     */
    draftMode?: boolean
    onSaved: (override: ListingAutomationOverride) => void
    /**
     * El override cambió SIN cerrar el modal: lo creó o lo releyó la sección de
     * texto del contrato de la unidad (contrato 2026-10-20). Sin esto, el modal
     * no se entera y su «Guardar» intentaría crear un segundo override.
     */
    onOverrideChanged?: (override: ListingAutomationOverride) => void
    /**
     * La unidad vuelve a heredar de la propiedad: se borró su override (o, en
     * borrador, se descartó). El llamador debe quitarlo de su estado.
     */
    onInheritRestored: () => void
}

/** Resolve the provider slug for a property automation. */
function slugOf(pa: PropertyAutomation | undefined | null): string {
    return pa?.provider?.parameters?.slug ?? pa?.providerName ?? ""
}

/** Ejecuta las llamadas en orden. Devuelve el override final, o `null` si terminó borrado (hereda). */
async function runOverrideOperations(ops: OverrideOperation[]): Promise<ListingAutomationOverride | null> {
    let result: ListingAutomationOverride | null = null
    for (const op of ops) {
        if (op.kind === "delete") {
            await automationService.deleteListingOverride(op.uuid)
            result = null
        } else if (op.kind === "create") {
            result = await automationService.createListingOverride(op.payload)
        } else {
            result = await automationService.updateListingOverride(op.uuid, op.payload)
        }
    }
    return result
}

/**
 * Placeholder de un campo que, vacío, usa el valor de la propiedad. Genérico a
 * propósito: el valor de la propiedad (token, contraseña, RNT…) no se muestra.
 */
const INHERITED_VALUE_PLACEHOLDER = "Usa el valor de la propiedad"

function isEmptyValue(v: unknown): boolean {
    if (v == null) return true
    if (typeof v === "string") return v.trim() === ""
    if (Array.isArray(v)) return v.length === 0
    return false
}

export function AutomationOverrideModal({
    open,
    onClose,
    listingUuid,
    listingName,
    propertyAutomations,
    override,
    existingOverridePAUuids = [],
    lockedPropertyAutomationUuid,
    draftMode = false,
    onSaved,
    onInheritRestored,
    onOverrideChanged,
}: Props) {
    const isEdit = !!override
    const [saving, setSaving] = useState(false)

    // Create-mode automation selection
    const [selectedPaUuid, setSelectedPaUuid] = useState<string>(
        override?.propertyAutomationUuid ?? lockedPropertyAutomationUuid ?? "",
    )

    const [isActive, setIsActive] = useState(override ? override.isActive : true)
    const [schemaValues, setSchemaValues] = useState<Record<string, unknown>>({})
    const [dirtySchemaKeys, setDirtySchemaKeys] = useState<ReadonlySet<string>>(new Set())
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const contentRef = useRef<HTMLDivElement>(null)

    // Automation backing this override (edit: from override; create: from selection)
    const activePa = useMemo<PropertyAutomation | undefined>(() => {
        if (isEdit) {
            return propertyAutomations.find(pa => pa.uuid === override?.propertyAutomationUuid)
        }
        return propertyAutomations.find(pa => pa.uuid === selectedPaUuid)
    }, [isEdit, override, propertyAutomations, selectedPaUuid])

    const slug = useMemo(() => {
        if (isEdit) return override?.propertyAutomation?.provider?.parameters?.slug ?? slugOf(activePa)
        return slugOf(activePa)
    }, [isEdit, override, activePa])

    // Override fields = the property-level config fields for this provider (all optional).
    const fieldSchema = useMemo(() => getOverrideFieldSchema(slug), [slug])
    const schemaKeys = useMemo(() => fieldSchema.map(f => f.key), [fieldSchema])

    // Identidad (contrato 2026-10-14): Heredar · Avanzada · Esencial · Desactivar
    // en vez del interruptor y los parámetros.
    const isIdentity = isIdentityPropertyAutomation(activePa ?? override?.propertyAutomation ?? null)
    // TRA/SIRE con credenciales por alojamiento (contrato 2026-11-10): no existe
    // «heredar». Sin override el alojamiento no se reporta; apagado, se excluye.
    const perListing = readCredentialsScope(activePa ?? override?.propertyAutomation ?? null) === "listing"
    const credentialState = perListing ? listingCredentialState(override) : null
    const catalog = useIdentityProviderCatalog(open && isIdentity)
    const [identityChoice, setIdentityChoice] = useState<IdentityChoice>("inherit")
    const [identityError, setIdentityError] = useState<string | null>(null)

    // Contrato: la unidad solo se apaga o hereda desde acá. Un ruteo propio de
    // la unidad (`contract_mode` + `by_source` en su override) lo acepta la API,
    // pero todavía no tiene pantalla: se respeta y no se pisa al guardar.
    const contractProvider = activePa?.provider ?? override?.propertyAutomation?.provider ?? null
    const isContract = (!!contractProvider && isSignatureProvider(contractProvider))
        || slug === "tufirma" || slug === "hitguest_signature"
    const contractHasOwnRouting = isContract && (
        override?.contractRouting?.routingSource === "listing"
        || (override?.parameters != null && "contract_mode" in override.parameters && override.parameters.contract_mode != null)
    )

    const contractPropertyUuid = activePa?.propertyUuid || override?.propertyAutomation?.propertyUuid || ""

    const basePa = override?.propertyAutomation
    const baseParams = (basePa?.parameters ?? activePa?.parameters ?? {}) as Record<string, unknown>

    // Only automations that support overrides (have configurable params) and aren't
    // already overridden are offered in the create dropdown.
    const availableAutomations = useMemo(
        () => propertyAutomations.filter(
            pa => !existingOverridePAUuids.includes(pa.uuid) && isOverridableSlug(slugOf(pa)),
        ),
        [propertyAutomations, existingOverridePAUuids],
    )

    // (Re)initialize state when the modal opens or its target changes.
    useEffect(() => {
        if (!open) return
        setSelectedPaUuid(override?.propertyAutomationUuid ?? lockedPropertyAutomationUuid ?? "")
        setIsActive(override ? override.isActive : true)
        // Los secretos nunca se precargan en el DOM. Si el backend devuelve un
        // valor real o enmascarado, dejarlo en un input permitiría verlo o
        // reenviarlo como si fuera la credencial. Vacío significa «sin cambio».
        const saved = (override?.parameters as Record<string, unknown>) ?? {}
        const passwordKeys = new Set(getOverrideFieldSchema(
            override?.propertyAutomation?.provider?.parameters?.slug ?? slugOf(activePa),
        ).filter((field) => field.type === "password").map((field) => field.key))
        setSchemaValues(Object.fromEntries(Object.entries(saved).filter(([key]) => !passwordKeys.has(key))))
        setDirtySchemaKeys(new Set())
        setFieldErrors({})
        setIdentityChoice(readIdentityOverrideState(override, catalog.catalog).choice)
        setIdentityError(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, override])

    // When the selected automation changes in create mode, reset provider-specific values.
    useEffect(() => {
        if (isEdit || !open) return
        setSchemaValues({})
        setDirtySchemaKeys(new Set())
        setFieldErrors({})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPaUuid])

    /** Build the `parameters` object to send. For edit, cleared known keys become null. */
    const buildParameters = (): Record<string, unknown> | null => {
        const out: Record<string, unknown> = {}
        // Only real PATCH updates need explicit nulls to clear previously-saved keys.
        const allowNullClears = isEdit && !draftMode

        for (const key of schemaKeys) {
            const field = fieldSchema.find((candidate) => candidate.key === key)
            const value = schemaValues[key]
            // Un secreto vacío significa «sin cambio», también si el PM escribió y
            // borró: el aviso dice «déjalo vacío para conservarlo», así que vacío
            // nunca se convierte en `null` (eso borraba el secreto guardado).
            if (field?.type === "password" && isEdit && (!dirtySchemaKeys.has(key) || isEmptyValue(value))) {
                // En un borrador el secreto solo existe en este estado local (no
                // se precarga en el DOM): se arrastra tal cual, o se perdía al
                // reabrir y guardar, y el POST posterior salía sin él.
                const kept = override?.parameters?.[key]
                if (draftMode && !isEmptyValue(kept)) out[key] = kept
                continue
            }
            if (!isEmptyValue(value)) {
                out[key] = value
            } else if (allowNullClears && override?.parameters && key in override.parameters) {
                out[key] = null // clear a previously-set key
            }
        }

        return Object.keys(out).length === 0 ? null : out
    }

    const requiredForThisSave = useMemo(() => {
        if (!perListing || !isActive) return new Set<string>()
        // Solo se exige lo que este modal muestra: una clave que no tiene campo
        // (o que llega en camelCase) dejaba un error sin campo que enfocar y el
        // guardado no hacía nada, sin mensaje. Lo demás lo valida el backend (422).
        const rendered = (keys: Iterable<string>) => new Set(
            [...keys].map((key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)).filter((key) => schemaKeys.includes(key)),
        )
        if (!isEdit) return rendered(requiredListingCredentialKeys(slug))
        if (draftMode) {
            // Un borrador es local: se sabe qué tiene. Lo que ya trae (un secreto
            // que no se precarga) no se vuelve a pedir.
            return rendered(requiredListingCredentialKeys(slug).filter((key) => isEmptyValue(override?.parameters?.[key])))
        }
        if (credentialState?.kind === "incomplete" && credentialState.missing.length > 0) {
            return rendered(credentialState.missing)
        }
        // Con credenciales confirmadas o metadatos ausentes no se obliga a
        // reescribir secretos que el backend puede haber omitido.
        return new Set<string>()
    }, [credentialState, draftMode, isActive, isEdit, override, perListing, schemaKeys, slug])

    const focusFirstInvalidField = () => {
        requestAnimationFrame(() => {
            contentRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
        })
    }

    /**
     * Guarda la elección de identidad con las llamadas que arma
     * `planIdentityOverrideWrite`. Un 422 en `property_automation_uuid` (otro
     * override creado mientras tanto) se resuelve releyendo los overrides de la
     * unidad y actualizando el existente, una sola vez.
     */
    const saveIdentity = async () => {
        const target = { listingUuid, propertyAutomationUuid: selectedPaUuid }
        setIdentityError(null)
        if (draftMode) {
            const draft = draftIdentityOverride({ ...target, choice: identityChoice, catalog: catalog.catalog })
            if (!draft) {
                onInheritRestored()
            } else {
                onSaved({
                    ...draft,
                    propertyAutomation: activePa
                        ? { uuid: activePa.uuid, name: activePa.name, parameters: activePa.parameters ?? null, provider: activePa.provider ?? null }
                        : override?.propertyAutomation ?? null,
                })
            }
            onClose()
            return
        }

        const plan = (current: ListingAutomationOverride | null) =>
            planIdentityOverrideWrite({ ...target, current, choice: identityChoice, catalog: catalog.catalog })

        const ops = plan(override ?? null)
        if (ops.length === 0) {
            toast.info("Sin cambios en esta unidad.")
            onClose()
            return
        }

        let saved: ListingAutomationOverride | null
        try {
            saved = await runOverrideOperations(ops)
        } catch (error) {
            if (!fieldErrorMessage(error, "property_automation_uuid", "propertyAutomationUuid")) throw error
            const existing = (await automationService.listListingOverrides(listingUuid))
                .find((o) => o.propertyAutomationUuid === selectedPaUuid) ?? null
            saved = await runOverrideOperations(plan(existing))
        }

        toast.success("Verificación de la unidad guardada")
        if (saved) onSaved(saved)
        else onInheritRestored()
        onClose()
    }

    const handleSave = async () => {
        if (isIdentity) {
            setSaving(true)
            try {
                await saveIdentity()
            } catch (error) {
                if (error instanceof IdentityProviderUnavailableError) setIdentityError(error.message)
                else {
                    const providerProblem = fieldErrorMessage(error, "provider_id", "providerId")
                    if (providerProblem) setIdentityError(providerProblem)
                    else toast.error(getErrorMessage(error, "No se pudo guardar la verificación de la unidad."))
                }
            } finally {
                setSaving(false)
            }
            return
        }
        if (!isEdit && !selectedPaUuid) {
            toast.error("Selecciona una automatización")
            return
        }
        const localErrors = Object.fromEntries(
            [...requiredForThisSave]
                .filter((key) => isEmptyValue(schemaValues[key]))
                .map((key) => [key, "Este campo es obligatorio para reportar este alojamiento."]),
        )
        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors)
            focusFirstInvalidField()
            return
        }
        setSaving(true)
        setFieldErrors({})
        try {
            const statusRecordId = isActive ? LISTING_OVERRIDE_STATUS.ACTIVE : LISTING_OVERRIDE_STATUS.INACTIVE
            // Contrato: sin campos en este modal, `parameters: null` borraría el
            // ruteo propio de la unidad (null en los dos = volver a heredar).
            const parameters = isContract ? undefined : buildParameters()
            let saved: ListingAutomationOverride

            // Una unidad SIN override ya hereda. Guardarla activa y sin parámetros
            // creaba una fila explícita que la lista mostraba como «Hereda de la
            // propiedad» sin serlo, y no había forma de borrarla. Sin cambios no
            // se crea nada.
            if (!isEdit && isActive && !parameters) {
                if (perListing) {
                    // Cerrar acá diría que el alojamiento quedó bien, y no se reporta.
                    toast.info(LISTING_CREDENTIALS_COPY.emptyCreate)
                    return
                }
                toast.info("Sin cambios: la unidad sigue heredando de la propiedad.")
                onClose()
                return
            }

            if (draftMode) {
                // No API call — synthesize an override the caller will persist later.
                saved = {
                    uuid: override?.uuid ?? "",
                    listingUuid,
                    propertyAutomationUuid: selectedPaUuid,
                    parameters: parameters ?? override?.parameters ?? null,
                    token: override?.token ?? null,
                    statusRecordId,
                    deletedAt: null,
                    propertyAutomation: activePa
                        ? {
                            uuid: activePa.uuid,
                            name: activePa.name,
                            parameters: activePa.parameters ?? null,
                            // El provider ya viene recortado por `sanitizeProvider()`
                            // en el servicio: reconstruir un subconjunto acá solo
                            // duplicaba la decisión de qué campos son seguros.
                            provider: activePa.provider ?? null,
                        }
                        : override?.propertyAutomation ?? null,
                    isActive,
                }
                onSaved(saved)
                onClose()
                return
            }

            if (isEdit && override) {
                saved = await automationService.updateListingOverride(override.uuid, {
                    statusRecordId,
                    ...(parameters !== undefined ? { parameters } : {}),
                })
            } else {
                saved = await automationService.createListingOverride({
                    listingUuid,
                    propertyAutomationUuid: selectedPaUuid,
                    statusRecordId,
                    parameters: parameters ?? null,
                })
            }
            toast.success("Override guardado")
            onSaved(saved)
            onClose()
        } catch (err: any) {
            const backendFieldErrors = Object.fromEntries(
                fieldSchema.flatMap((field) => {
                    const message = fieldErrorMessage(err, `parameters.${field.key}`, field.key)
                    return message ? [[field.key, message]] : []
                }),
            )
            if (Object.keys(backendFieldErrors).length > 0) {
                setFieldErrors(backendFieldErrors)
                focusFirstInvalidField()
            } else {
                const msg = err?.data?.message || err?.message || "Error al guardar el override"
                toast.error(msg)
            }
        } finally {
            setSaving(false)
        }
    }

    /** Borra el override y la unidad vuelve a heredar. En borrador no hay nada que borrar en el servidor. */
    const handleRestoreInheritance = async () => {
        if (!override) return
        setSaving(true)
        try {
            if (!draftMode && override.uuid) {
                await automationService.deleteListingOverride(override.uuid)
            }
            toast.success(perListing ? LISTING_CREDENTIALS_COPY.removed : "La unidad vuelve a heredar de la propiedad")
            onInheritRestored()
            onClose()
        } catch (err) {
            toast.error(getErrorMessage(err, "No se pudo quitar el override"))
        } finally {
            setSaving(false)
        }
    }

    const automationLabel = isEdit
        ? (activePa ? automationTitle(activePa) : override?.propertyAutomation?.name ?? "Automatización")
        : (activePa ? automationTitle(activePa) : "")

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent ref={contentRef} className={cn("max-h-[88vh] overflow-y-auto", isContract ? "sm:max-w-3xl" : "sm:max-w-lg")}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon icon={Building2} className="text-primary" />
                        {isEdit ? "Editar override" : "Configurar override"}
                        {listingName && (
                            <span className="text-xs font-normal text-ink-3">· {listingName}</span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-ink-3">
                        {automationLabel
                            ? <>Automatización: <span className="font-semibold">{automationLabel}</span></>
                            : "Elige una automatización y sobrescribe su configuración para esta unidad."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Create-only: pick the property automation */}
                    {!isEdit && !lockedPropertyAutomationUuid && (
                        <div className="grid gap-1.5">
                            <Label className="text-sm font-semibold text-ink-2">Automatización de la propiedad</Label>
                            {availableAutomations.length === 0 ? (
                                <FeedbackBanner tone="info" density="compact">
                                    No hay automatizaciones sobrescribibles disponibles para esta unidad.
                                </FeedbackBanner>
                            ) : (
                                <Select value={selectedPaUuid} onValueChange={setSelectedPaUuid}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una automatización" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableAutomations.map(pa => (
                                            <SelectItem key={pa.uuid} value={pa.uuid}>
                                                {automationTitle(pa)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    {isIdentity && (
                        <IdentityOverrideSelector
                            value={identityChoice}
                            onChange={(choice) => { setIdentityChoice(choice); setIdentityError(null) }}
                            inheritDescription={inheritDescription(activePa ?? null)}
                            canOverrideLevel={propertySlotCanBeOverridden(activePa ?? null)}
                            catalog={catalog}
                            error={identityError}
                            disabled={saving}
                        />
                    )}

                    {/* Status toggle */}
                    {!isIdentity && (
                    <SwitchField
                        // Excluir en modo por alojamiento es una decisión, no un fallo: sin tinta de peligro.
                        tone={isActive || perListing ? "neutral" : "danger"}
                        label={perListing
                            ? isActive ? LISTING_CREDENTIALS_COPY.activeLabel : LISTING_CREDENTIALS_COPY.excludedLabel
                            : isActive ? "Activa en esta unidad" : "Desactivada para esta unidad"}
                        description={isContract
                            ? !isActive
                                ? "Los huéspedes de esta unidad no firmarán contrato."
                                : contractHasOwnRouting
                                    ? "Esta unidad tiene su propio contrato por canal."
                                    : "Firman el contrato de la propiedad. Apágalo para que no firmen en esta unidad."
                            : perListing
                            ? !isActive
                                ? LISTING_CREDENTIALS_COPY.excludedHelp
                                : isEdit ? LISTING_CREDENTIALS_COPY.activeHelpEdit : LISTING_CREDENTIALS_COPY.activeHelpNew
                            : !isActive
                            ? "La automatización se omite para reservas de esta unidad."
                            : isEdit
                                ? "Esta unidad tiene un override propio: aplica con los parámetros de abajo."
                                : "Hoy hereda de la propiedad. Apágala para omitirla en esta unidad."}
                        checked={isActive}
                        onCheckedChange={setIsActive}
                    />
                    )}

                    {/* Texto del contrato de la unidad (contrato 2026-10-20): solo con el
                        contrato activo en la unidad, y solo en una unidad ya guardada. */}
                    {isContract && isActive && (
                        draftMode || !listingUuid || !contractPropertyUuid || !onOverrideChanged ? (
                            <Note>
                                Guarda la unidad para poder personalizar el texto de su contrato.
                            </Note>
                        ) : override && !override.isActive ? (
                            <Note>
                                Guarda primero para activar el contrato en esta unidad; después podrás personalizar su texto.
                            </Note>
                        ) : (
                            <UnitContractTexts
                                propertyUuid={contractPropertyUuid}
                                listingUuid={listingUuid}
                                propertyAutomationUuid={selectedPaUuid}
                                override={override ?? null}
                                propertyRouting={activePa?.contractRouting ?? null}
                                onOverrideChanged={onOverrideChanged}
                                disabled={saving}
                            />
                        )
                    )}

                    {/* Provider-specific fields — identical to the property config, all optional */}
                    {!isIdentity && (isEdit || selectedPaUuid) && fieldSchema.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-sunk" />
                                <p className="text-xs font-bold text-ink-3">
                                    Parámetros de la unidad
                                </p>
                                <div className="h-px flex-1 bg-sunk" />
                            </div>

                            <FeedbackBanner tone="info" density="compact">
                                {perListing
                                    ? LISTING_CREDENTIALS_COPY.fieldsNotice
                                    : "Son los mismos campos que configuras en la propiedad. Completa solo lo que cambia en esta unidad — lo que dejes vacío hereda el valor de la propiedad."}
                            </FeedbackBanner>

                            {fieldSchema.map(field => {
                                // Solo se mira SI la propiedad tiene el valor, nunca cuál es:
                                // antes iba en el placeholder («Heredar: <valor>»), y un
                                // placeholder se ve en claro aunque el campo sea de contraseña.
                                // En modo por alojamiento no se usa el de la propiedad: sin esa pista.
                                const propertyHasValue = !perListing && !isEmptyValue(baseParams?.[field.key])
                                const overrideHasSecretValue = !isEmptyValue(override?.parameters?.[field.key])
                                const alreadyConfiguredSecret = isEdit
                                    && field.type === "password"
                                    && (overrideHasSecretValue
                                        || credentialState?.kind === "ready"
                                        || (credentialState?.kind === "incomplete" && !credentialState.missing.includes(field.key)))
                                const required = requiredForThisSave.has(field.key)
                                return (
                                    <div key={field.key} className="space-y-1">
                                        <ParameterField
                                            schema={
                                                {
                                                    ...field,
                                                    required,
                                                    ...(field.type !== "array" && field.type !== "select" && propertyHasValue
                                                        ? { placeholder: INHERITED_VALUE_PLACEHOLDER }
                                                        : alreadyConfiguredSecret
                                                            ? { placeholder: "Ya configurado · escribe para reemplazarlo" }
                                                            : {}),
                                                }
                                            }
                                            value={schemaValues[field.key]}
                                            onChange={v => {
                                                setDirtySchemaKeys((prev) => new Set([...prev, field.key]))
                                                setSchemaValues(prev => ({ ...prev, [field.key]: v }))
                                                setFieldErrors((prev) => {
                                                    if (!(field.key in prev)) return prev
                                                    const next = { ...prev }
                                                    delete next[field.key]
                                                    return next
                                                })
                                            }}
                                            error={fieldErrors[field.key]}
                                            hint={alreadyConfiguredSecret ? "Ya configurado; déjalo vacío para conservarlo." : undefined}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {/* En identidad, «Heredar» es una de las opciones del selector. */}
                    {isEdit && !isIdentity && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleRestoreInheritance()}
                            disabled={saving}
                            className="sm:mr-auto"
                        >
                            {perListing ? LISTING_CREDENTIALS_COPY.remove : "Volver a heredar"}
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!isEdit && !selectedPaUuid} loading={saving}>
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
