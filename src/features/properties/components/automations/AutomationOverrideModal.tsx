"use client"

import { useState, useEffect, useMemo } from "react"
import { Building2, Info, Loader2, Lock, ChevronDown, ChevronRight } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { automationService } from "../../services/automation-service"
import { getOverrideFieldSchema } from "../../data/automation-definitions"
import {
    LISTING_OVERRIDE_STATUS,
    type ListingAutomationOverride,
    type PropertyAutomation,
} from "../../types/automation"
import { ParameterField } from "./ParameterField"
import { GenericKeyValueEditor, type KeyValueRow } from "./GenericKeyValueEditor"

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

/** Split an override's parameters into provider-schema values vs. generic key-value rows. */
function splitParameters(
    parameters: Record<string, unknown> | null | undefined,
    schemaKeys: string[],
): { schemaValues: Record<string, unknown>; genericRows: KeyValueRow[] } {
    const schemaValues: Record<string, unknown> = {}
    const genericRows: KeyValueRow[] = []
    for (const [key, value] of Object.entries(parameters ?? {})) {
        if (schemaKeys.includes(key)) {
            schemaValues[key] = value
        } else {
            genericRows.push({ key, value: value == null ? "" : String(value) })
        }
    }
    return { schemaValues, genericRows }
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
    const [genericRows, setGenericRows] = useState<KeyValueRow[]>([])

    // Token (advanced) section
    const [tokenOpen, setTokenOpen] = useState(false)
    const [tokenValue, setTokenValue] = useState("")
    const [clearToken, setClearToken] = useState(false)

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

    const fieldSchema = useMemo(() => getOverrideFieldSchema(slug), [slug])
    const schemaKeys = useMemo(() => fieldSchema.map(f => f.key), [fieldSchema])

    const basePa = override?.propertyAutomation
    const baseParams = (basePa?.parameters ?? activePa?.parameters ?? {}) as Record<string, unknown>

    // Available automations for the create dropdown (exclude those already overridden)
    const availableAutomations = useMemo(
        () => propertyAutomations.filter(pa => !existingOverridePAUuids.includes(pa.uuid)),
        [propertyAutomations, existingOverridePAUuids],
    )

    // (Re)initialize state when the modal opens or its target changes.
    useEffect(() => {
        if (!open) return
        const keys = getOverrideFieldSchema(
            isEdit
                ? (override?.propertyAutomation?.provider?.parameters?.slug ?? "")
                : "",
        ).map(f => f.key)
        const sourceKeys = isEdit ? keys : []
        const { schemaValues: sv, genericRows: gr } = splitParameters(override?.parameters, sourceKeys)
        setSelectedPaUuid(override?.propertyAutomationUuid ?? lockedPropertyAutomationUuid ?? "")
        setIsActive(override ? override.isActive : true)
        setSchemaValues(sv)
        setGenericRows(gr)
        setTokenValue("")
        setClearToken(false)
        setTokenOpen(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, override])

    // When the selected automation changes in create mode, reset provider-specific values.
    useEffect(() => {
        if (isEdit || !open) return
        setSchemaValues({})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPaUuid])

    const hasAutoToken = isEdit && override?.token != null

    /** Build the `parameters` object to send. For edit, cleared known keys become null. */
    const buildParameters = (): Record<string, unknown> | null => {
        const out: Record<string, unknown> = {}

        // For drafts (create-time) we never inject nulls — only real PATCH updates
        // need explicit nulls to clear previously-saved keys.
        const allowNullClears = isEdit && !draftMode

        // Provider-specific fields
        for (const key of schemaKeys) {
            const value = schemaValues[key]
            if (!isEmptyValue(value)) {
                out[key] = value
            } else if (allowNullClears && override?.parameters && key in override.parameters) {
                out[key] = null // clear a previously-set key
            }
        }

        // Generic rows
        const seen = new Set<string>()
        for (const row of genericRows) {
            const k = row.key.trim()
            if (!k) continue
            seen.add(k)
            out[k] = row.value
        }
        // Generic keys removed since last save → clear them
        if (allowNullClears && override?.parameters) {
            for (const k of Object.keys(override.parameters)) {
                if (!schemaKeys.includes(k) && !seen.has(k)) out[k] = null
            }
        }

        if (Object.keys(out).length === 0) return isEdit ? null : null
        return out
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
                    token: clearToken ? null : (tokenValue.trim() || override?.token || null),
                    statusRecordId,
                    deletedAt: null,
                    propertyAutomation: activePa
                        ? {
                            uuid: activePa.uuid,
                            name: activePa.name,
                            parameters: activePa.parameters ?? null,
                            provider: activePa.provider
                                ? { id: activePa.provider.id, name: activePa.provider.name, parameters: activePa.provider.parameters }
                                : null,
                        }
                        : override?.propertyAutomation ?? null,
                    isActive,
                }
                onSaved(saved)
                onClose()
                return
            }

            if (isEdit && override) {
                const tokenPatch =
                    clearToken ? { token: null } : tokenValue.trim() ? { token: tokenValue.trim() } : {}
                saved = await automationService.updateListingOverride(override.uuid, {
                    statusRecordId,
                    parameters,
                    ...tokenPatch,
                })
            } else {
                saved = await automationService.createListingOverride({
                    listingUuid,
                    propertyAutomationUuid: selectedPaUuid,
                    statusRecordId,
                    parameters,
                    ...(tokenValue.trim() ? { token: tokenValue.trim() } : {}),
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
                            ? <>Automatización: <span className="font-semibold">{automationLabel}</span>{slug && <span className="text-slate-400"> ({slug})</span>}</>
                            : "Configura los parámetros de esta automatización para la unidad."
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
                                        Todas las automatizaciones de la propiedad ya tienen un override para esta unidad.
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
                                                {slugOf(pa) ? ` · ${slugOf(pa)}` : ""}
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

                    {/* Auto-generated token badge (read indicator) */}
                    {hasAutoToken && (
                        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <Lock size={13} className="text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600">
                                Token configurado por el servidor — no recuperable en texto plano.
                            </p>
                        </div>
                    )}

                    {/* Provider-specific fields */}
                    {(isEdit || selectedPaUuid) && (
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
                                    Solo completa lo que es diferente en esta unidad. Lo que dejes vacío hereda el valor de la propiedad.
                                </p>
                            </div>

                            {fieldSchema.length > 0 ? (
                                fieldSchema.map(field => {
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
                                })
                            ) : (
                                <p className="text-xs text-slate-400">
                                    Este proveedor no tiene parámetros específicos configurables. Puedes usar parámetros personalizados abajo.
                                </p>
                            )}

                            {/* Generic key-value editor */}
                            <div className="space-y-2 pt-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Parámetros personalizados
                                </p>
                                <GenericKeyValueEditor
                                    rows={genericRows}
                                    onChange={setGenericRows}
                                    reservedKeys={schemaKeys}
                                />
                            </div>

                            {/* Token (advanced) */}
                            <div className="border-t border-slate-200 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setTokenOpen(o => !o)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                                >
                                    {tokenOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    Token (avanzado)
                                </button>
                                {tokenOpen && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-[11px] text-slate-500">
                                            Deja vacío para usar el token de la automatización de la propiedad. Si el proveedor
                                            auto-genera tokens, dejarlo vacío creará un nuevo token (Sanctum) para esta unidad.
                                        </p>
                                        <Input
                                            type="text"
                                            placeholder={hasAutoToken ? "Reemplazar token actual…" : "Token personalizado para esta unidad"}
                                            value={tokenValue}
                                            disabled={clearToken}
                                            onChange={e => setTokenValue(e.target.value)}
                                            className="bg-slate-50 border-slate-200"
                                        />
                                        {isEdit && hasAutoToken && (
                                            <label className="flex items-center gap-2 text-xs text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={clearToken}
                                                    onChange={e => setClearToken(e.target.checked)}
                                                    className="rounded border-slate-300"
                                                />
                                                Limpiar token (volver al de la propiedad)
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
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
