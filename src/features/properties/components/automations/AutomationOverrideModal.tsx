"use client"

import { useState, useEffect, useMemo } from "react"
import { Building2, Info, Loader2 } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { automationService } from "../../services/automation-service"
import { getOverrideFieldSchema, isOverridableSlug } from "../../data/automation-definitions"
import {
    LISTING_OVERRIDE_STATUS,
    type ListingAutomationOverride,
    type PropertyAutomation,
} from "../../types/automation"
import { ParameterField } from "./ParameterField"

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
}

/** Resolve the provider slug for a property automation. */
function slugOf(pa: PropertyAutomation | undefined | null): string {
    return pa?.provider?.parameters?.slug ?? pa?.providerName ?? ""
}

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
}: Props) {
    const isEdit = !!override
    const [saving, setSaving] = useState(false)

    // Create-mode automation selection
    const [selectedPaUuid, setSelectedPaUuid] = useState<string>(
        override?.propertyAutomationUuid ?? lockedPropertyAutomationUuid ?? "",
    )

    const [isActive, setIsActive] = useState(override ? override.isActive : true)
    const [schemaValues, setSchemaValues] = useState<Record<string, unknown>>({})

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
        // Seed the known provider fields from the saved override parameters.
        setSchemaValues((override?.parameters as Record<string, unknown>) ?? {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, override])

    // When the selected automation changes in create mode, reset provider-specific values.
    useEffect(() => {
        if (isEdit || !open) return
        setSchemaValues({})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPaUuid])

    /** Build the `parameters` object to send. For edit, cleared known keys become null. */
    const buildParameters = (): Record<string, unknown> | null => {
        const out: Record<string, unknown> = {}
        // Only real PATCH updates need explicit nulls to clear previously-saved keys.
        const allowNullClears = isEdit && !draftMode

        for (const key of schemaKeys) {
            const value = schemaValues[key]
            if (!isEmptyValue(value)) {
                out[key] = value
            } else if (allowNullClears && override?.parameters && key in override.parameters) {
                out[key] = null // clear a previously-set key
            }
        }

        return Object.keys(out).length === 0 ? null : out
    }

    const handleSave = async () => {
        if (!isEdit && !selectedPaUuid) {
            toast.error("Selecciona una automatización")
            return
        }
        setSaving(true)
        try {
            const statusRecordId = isActive ? LISTING_OVERRIDE_STATUS.ACTIVE : LISTING_OVERRIDE_STATUS.INACTIVE
            const parameters = buildParameters()
            let saved: ListingAutomationOverride

            if (draftMode) {
                // No API call — synthesize an override the caller will persist later.
                saved = {
                    uuid: override?.uuid ?? "",
                    listingUuid,
                    propertyAutomationUuid: selectedPaUuid,
                    parameters,
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
                    parameters,
                })
            } else {
                saved = await automationService.createListingOverride({
                    listingUuid,
                    propertyAutomationUuid: selectedPaUuid,
                    statusRecordId,
                    parameters,
                })
            }
            toast.success("Override guardado")
            onSaved(saved)
            onClose()
        } catch (err: any) {
            const msg = err?.data?.message || err?.message || "Error al guardar el override"
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const automationLabel = isEdit
        ? (override?.propertyAutomation?.name ?? activePa?.name ?? "Automatización")
        : (activePa?.name ?? "")

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Building2 size={16} className="text-[var(--color-brand-purple)]" />
                        {isEdit ? "Editar override" : "Configurar override"}
                        {listingName && (
                            <span className="text-xs font-normal text-slate-400">· {listingName}</span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
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
                            <Label className="text-sm font-semibold text-slate-700">Automatización de la propiedad</Label>
                            {availableAutomations.length === 0 ? (
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
                                    <Info size={13} className="text-amber-500 shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        No hay automatizaciones sobrescribibles disponibles para esta unidad.
                                    </p>
                                </div>
                            ) : (
                                <Select value={selectedPaUuid} onValueChange={setSelectedPaUuid}>
                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                        <SelectValue placeholder="Selecciona una automatización" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableAutomations.map(pa => (
                                            <SelectItem key={pa.uuid} value={pa.uuid}>
                                                {pa.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    {/* Status toggle */}
                    <div className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-colors",
                        isActive ? "bg-slate-50 border-slate-200" : "bg-red-50 border-red-200"
                    )}>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">
                                {isActive ? "Activa en esta unidad" : "Desactivada para esta unidad"}
                            </Label>
                            <p className="text-[11px] text-slate-500">
                                {isActive
                                    ? "El override aplica y la automatización se ejecuta para esta unidad."
                                    : "La automatización se omite para reservas de esta unidad."}
                            </p>
                        </div>
                        <Switch
                            checked={isActive}
                            onCheckedChange={setIsActive}
                            className="data-[state=checked]:bg-[var(--color-brand-purple)]"
                        />
                    </div>

                    {/* Provider-specific fields — identical to the property config, all optional */}
                    {(isEdit || selectedPaUuid) && fieldSchema.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-slate-200" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Parámetros de la unidad
                                </p>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700">
                                    Son los mismos campos que configuras en la propiedad. Completa solo lo que cambia
                                    en esta unidad — lo que dejes vacío hereda el valor de la propiedad.
                                </p>
                            </div>

                            {fieldSchema.map(field => {
                                const baseHint = baseParams?.[field.key]
                                return (
                                    <div key={field.key} className="space-y-1">
                                        <ParameterField
                                            schema={
                                                field.type !== "array" && field.type !== "select" && baseHint != null
                                                    ? { ...field, placeholder: `Heredar: ${String(baseHint)}` }
                                                    : field
                                            }
                                            value={schemaValues[field.key]}
                                            onChange={v => setSchemaValues(prev => ({ ...prev, [field.key]: v }))}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || (!isEdit && !selectedPaUuid)}
                        className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white"
                    >
                        {saving && <Loader2 size={16} className="animate-spin mr-2" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
