"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Edit2, Building, BedDouble, Bath, Clock, Settings2, Shield, Zap, Loader2, Info, TriangleAlert } from "lucide-react"
import { useFormContext, useFieldArray } from "react-hook-form"
import { useState, useEffect, useRef } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listingsService } from "../services/listings-service"
import { automationService } from "../services/automation-service"
import { getOverrideFieldSchema } from "../data/automation-definitions"
import { type PropertyAutomation, type ListingAutomationOverride } from "../types/automation"
import { AutomationOverrideModal } from "./automations/AutomationOverrideModal"
import { Badge } from "@/components/ui/badge"
import { ExternalPmsIdsField } from "./ExternalPmsIdsField"
import {
    hasIncompleteExternalPmsId,
    normalizeExternalPmsIds,
    readExternalPmsIds,
    readExternalIdentifierServerErrors,
    sameExternalPmsIds,
} from "../lib/external-pms-ids"
import { ApiError } from "@/types/api"
import {
    validateUnitForm,
    toFieldErrorMap,
    UNIT_LIMITS,
    type UnitFormTab,
} from "../lib/unit-form-validation"
import { toListingPayload } from "../lib/listing-payload"
import type { ExternalPmsId } from "../types"

const defaultUnit = {
    name: "",
    internalName: "",
    roomTypeId: 0,
    thumbnailUrl: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=60",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    statusRecordId: 6,
    isActive: true,
    externalPmsIds: [] as ExternalPmsId[],
    extra: {
        currency: "COP",
        picturesUrl: [],
        bedRoom: 1,
        bathRoom: 1,
        rooms: 1,
        maxOccupancy: 2,
        minNights: 1,
        maxNights: 30,
        checkIn: "15:00",
        checkOut: "11:00",
        wifiDetails: { network: "", password: "" },
        amenities: [],
        cancellationPolicy: "STANDARD",
        inheritAmenities: true,
        inheritWifi: true,
        inheritSchedule: true,
        inheritPolicies: true,
    },
    price: "",
}

/**
 * Mensaje de error bajo un input. Aparece cinco veces en el tab General, así que
 * se extrae — no antes: es el tercer uso lo que lo justifica, no el primero.
 * Devuelve `null` sin mensaje para poder llamarlo sin envolverlo en un `&&`.
 */
function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return (
        <p role="alert" className="text-xs text-destructive">
            {message}
        </p>
    )
}

/** A draft override is worth persisting only if it changes something vs. inheriting. */
function isMeaningfulOverride(o: ListingAutomationOverride): boolean {
    if (!o.isActive) return true
    if (o.token) return true
    const params = o.parameters ?? {}
    return Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
}

export function PropertiesUnits() {
    const { control, watch } = useFormContext()
    // uuid is injected by the edit page — undefined for new properties
    const propertyUuid: string | undefined = watch("uuid")

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "units",
    })

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [unitForm, setUnitForm] = useState({ ...defaultUnit })
    const [roomTypes, setRoomTypes] = useState<CatalogOption[]>([])
    const [currencies, setCurrencies] = useState<CatalogOption[]>([])
    const [roomTypesLoading, setRoomTypesLoading] = useState(true)
    const [isSavingUnit, setIsSavingUnit] = useState(false)
    const saveLockRef = useRef(false)

    // ── Automations overrides state ──────────────────────────────────────────
    // Active property-level automations of the parent property
    const [propertyAutomations, setPropertyAutomations] = useState<PropertyAutomation[]>([])
    // Current listing's overrides map: automationUuid → override (uuid="" = unsaved draft)
    const [listingOverrides, setListingOverrides] = useState<Record<string, ListingAutomationOverride>>({})
    const [overridesLoading, setOverridesLoading] = useState(false)
    // Automation whose override modal is currently open
    const [editingOverrideAutomation, setEditingOverrideAutomation] = useState<PropertyAutomation | null>(null)

    // This dialog has no zod resolver, so incomplete external-id rows are marked
    // only once the PM actually tries to save — flagging a row they just added
    // and haven't filled in yet would be nagging, not helping.
    const [showExternalPmsIdErrors, setShowExternalPmsIdErrors] = useState(false)

    // Errores de campo del intento de guardado, indexados por campo. Se limpian
    // al reabrir el diálogo — no al teclear: un error que desaparece mientras el
    // PM corrige OTRO campo hace parecer que ya está resuelto.
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    // Snapshot de los identificadores al abrir el diálogo: decide si la sección
    // se editó (contrato 2026-08-23: la clave solo viaja si cambió — `[]` borra
    // todas las filas y la clave omitida no toca nada).
    const initialExternalPmsIdsRef = useRef<ExternalPmsId[]>([])
    // Errores 422 del backend atribuidos a filas de identificadores (las claves
    // llegan como `externalIdentifiers.N.campo`). Se limpian al editar la
    // sección o reabrir el diálogo.
    const [serverIdentifierErrors, setServerIdentifierErrors] = useState<
        Record<number, { sourcePmsId?: string; externalId?: string }>
    >({})

    // Las pestañas pasan a ser controladas para poder ABRIR la que tiene el
    // error. Antes eran `defaultValue="general"` y el aviso de identificación
    // externa decía "Revisa la pestaña General" — un rodeo de texto para algo
    // que la UI puede hacer sola.
    const [activeTab, setActiveTab] = useState<UnitFormTab | "automations">("general")
    // Errores por fila: los de completitud local y los que el backend atribuyó
    // (422) conviven — el mensaje del servidor llega ya localizado y manda.
    const hasServerIdentifierErrors = Object.keys(serverIdentifierErrors).length > 0
    const externalPmsIdRowErrors = showExternalPmsIdErrors || hasServerIdentifierErrors
        ? (unitForm.externalPmsIds ?? []).map((row, index) => ({
            sourcePmsId: (showExternalPmsIdErrors && !row.sourcePmsId ? "Selecciona el origen" : undefined)
                ?? serverIdentifierErrors[index]?.sourcePmsId,
            externalId: (showExternalPmsIdErrors && !String(row.externalId ?? "").trim() ? "Ingresa el ID externo" : undefined)
                ?? serverIdentifierErrors[index]?.externalId,
        }))
        : undefined

    useEffect(() => {
        // `active` como en el resto del repo (ContractRoutingSection,
        // GuaranteePreview): sin él, salir de la propiedad antes de que el
        // catálogo responda escribe estado sobre un componente desmontado.
        let active = true
        Promise.all([catalogService.getRoomTypes(), catalogService.getCurrencies()])
            .then(([rooms, curr]) => {
                if (!active) return
                setRoomTypes(rooms)
                if (curr.length > 0) setCurrencies(curr)
            })
            .finally(() => {
                if (active) setRoomTypesLoading(false)
            })
        return () => { active = false }
    }, [])

    const handleOpenAddDialog = () => {
        setUnitForm({ ...defaultUnit })
        setEditingIndex(null)
        setListingOverrides({})
        setShowExternalPmsIdErrors(false)
        setFieldErrors({})
        initialExternalPmsIdsRef.current = []
        setServerIdentifierErrors({})
        setActiveTab("general")
        setPropertyAutomations([])
        saveLockRef.current = false
        setIsSavingUnit(false)
        // New listing under an existing property: load automations so the user can
        // configure override drafts that get created right after the listing is saved.
        if (propertyUuid) {
            setOverridesLoading(true)
            automationService.listGlobal({ propertyUuid })
                .then(automations => setPropertyAutomations(automations.filter(a => a.isActive)))
                .catch(() => setPropertyAutomations([]))
                .finally(() => setOverridesLoading(false))
        }
        setIsDialogOpen(true)
    }

    const handleOpenEditDialog = (index: number) => {
        const raw = fields[index] as any
        // Normalize: API returns nested objects; flatten to camelCase for the form
        const normalized = {
            ...raw,
            internalName:  raw.internalName  || raw.internal_name  || "",
            // API returns roomType: { id, name } — flatten to roomTypeId
            roomTypeId:    raw.roomType?.id  || raw.roomTypeId    || raw.room_type_id    || 0,
            // API returns contact: { name, email, phone } — flatten
            contactName:   raw.contact?.name  || raw.contactName   || raw.contact_name   || "",
            contactEmail:  raw.contact?.email || raw.contactEmail  || raw.contact_email  || "",
            contactPhone:  raw.contact?.phone || raw.contactPhone  || raw.contact_phone  || "",
            description:   raw.description   || "",
            thumbnailUrl:  raw.thumbnailUrl  || raw.thumbnail_url  || "",
            price:         raw.extra?.startPrice || raw.extra?.price || raw.price || raw.total_price || raw.start_price || "",
            // API returns statusRecord: { id } — determine isActive
            isActive:      raw.isActive ?? (raw.statusRecord?.id === 6 || raw.statusRecordId === 6 || raw.status_record_id === 6) ?? true,
            statusRecordId: raw.statusRecord?.id || raw.statusRecordId || raw.status_record_id || 6,
            externalPmsIds: normalizeExternalPmsIds(raw),
            extra: {
                ...defaultUnit.extra,
                ...(raw.extra || {}),
                inheritAmenities: raw.extra?.amenities === undefined,
                currency: raw.extra?.currency || "COP",
                // Ensure wifi nulls become empty strings for controlled inputs
                wifiDetails: {
                    network:  raw.extra?.wifiDetails?.network  ?? "",
                    password: raw.extra?.wifiDetails?.password ?? "",
                },
            },
        }
        setUnitForm(normalized)
        setEditingIndex(index)
        setListingOverrides({})
        setShowExternalPmsIdErrors(false)
        setFieldErrors({})
        initialExternalPmsIdsRef.current = normalized.externalPmsIds ?? []
        setServerIdentifierErrors({})
        setActiveTab("general")
        saveLockRef.current = false
        setIsSavingUnit(false)

        // Load property automations and listing overrides for existing listings
        if (propertyUuid && raw.uuid) {
            setOverridesLoading(true)
            Promise.all([
                automationService.listGlobal({ propertyUuid }),
                automationService.listListingOverrides(raw.uuid),
            ]).then(([automations, overrides]) => {
                setPropertyAutomations(automations.filter(a => a.isActive))

                // Build overrides map keyed by property automation uuid
                const map: Record<string, ListingAutomationOverride> = {}
                for (const o of overrides) {
                    map[o.propertyAutomationUuid] = o
                }
                setListingOverrides(map)
            }).catch(() => {
                setPropertyAutomations([])
            }).finally(() => setOverridesLoading(false))
        } else {
            setPropertyAutomations([])
        }

        setIsDialogOpen(true)
    }

    const handleSaveUnit = async () => {
        if (saveLockRef.current) return
        // Este diálogo no tiene resolver de zod (el formulario de propiedad sí),
        // así que las reglas se aplican acá. Antes sólo se comprobaba el nombre:
        // todo lo demás —incluido el correo que la UI marca con asterisco— viajaba
        // al backend y volvía como 422 crudo, con el PM sin saber qué campo era.
        const errors = validateUnitForm(unitForm)
        if (errors.length > 0) {
            setFieldErrors(toFieldErrorMap(errors))
            // Abrir la pestaña del primer error: el correo vive al final del tab
            // General y es justo el que el PM no ve antes de pulsar guardar.
            setActiveTab(errors[0].tab)
            window.setTimeout(() => document.getElementById(errors[0].field)?.focus(), 0)
            toast.error(
                errors.length === 1 ? "Falta un dato de la unidad" : `Faltan ${errors.length} datos de la unidad`,
                { description: errors[0].message },
            )
            return
        }
        setFieldErrors({})

        // The property form gets this from zod; this dialog has no resolver, so the
        // same rule is enforced here rather than letting a half-filled row 422.
        if (hasIncompleteExternalPmsId(unitForm.externalPmsIds)) {
            setShowExternalPmsIdErrors(true)
            setActiveTab("general")
            toast.error("Identificación externa incompleta", {
                description: "Cada origen necesita su ID externo, o quita la fila.",
            })
            return
        }

        saveLockRef.current = true
        setIsSavingUnit(true)

        // ── Existing property: persist via API immediately ──
        if (propertyUuid) {
            try {
                const unitPrice = Number(unitForm.price) || 0
                // Dirty-gating del contrato 2026-08-23: `externalPmsIds` solo
                // viaja si la sección cambió respecto a lo cargado — `[]` borra
                // todas las filas y la clave omitida no toca nada.
                const identifiersDirty = !sameExternalPmsIds(
                    initialExternalPmsIdsRef.current,
                    unitForm.externalPmsIds,
                )
                const payload = toListingPayload(
                    propertyUuid,
                    identifiersDirty ? unitForm : { ...unitForm, externalPmsIds: undefined },
                )

                // UPDATE also needs price at top-level (PUT /listings accepts it; POST does not)
                const updatePayload = { ...payload, price: unitPrice, start_price: unitPrice }

                if (editingIndex !== null && (unitForm as any).uuid) {
                    // UPDATE existing listing — use updatePayload which includes root-level price (PUT accepts it)
                    const updated = await listingsService.update((unitForm as any).uuid, updatePayload as any)
                    const apiData = updated?.data ?? updated ?? {}
                    // Rebuild local state: price comes from extra.startPrice
                    const refreshed = {
                        ...unitForm,
                        ...apiData,
                        roomTypeId:    apiData.roomType?.id    || unitForm.roomTypeId,
                        contactName:   apiData.contact?.name   || unitForm.contactName,
                        contactEmail:  apiData.contact?.email  || unitForm.contactEmail,
                        contactPhone:  apiData.contact?.phone  || unitForm.contactPhone,
                        isActive:      apiData.statusRecord ? apiData.statusRecord.id === 6 : unitForm.isActive,
                        // Rehidratar SIEMPRE desde la respuesta (contrato
                        // 2026-08-23: `update` carga la relación y los `id` de
                        // las filas —nuevos o recreados por cambio de source—
                        // solo existen allí; el próximo guardado sin ellos es un
                        // 422). `null` = la respuesta no trajo la clave: se
                        // conserva lo local en vez de inventar un vacío.
                        externalPmsIds: readExternalPmsIds(apiData) ?? unitForm.externalPmsIds,
                        // Restore price checking root and extra
                        price:         apiData.price || apiData.startPrice || apiData.start_price || apiData.extra?.price || apiData.extra?.startPrice || unitForm.price,
                        extra: {
                            ...unitForm.extra,
                            ...(apiData.extra || {}),
                            startPrice: Number(unitForm.price) || 0,
                            price: Number(unitForm.price) || 0,
                            currency:   apiData.extra?.currency || unitForm.extra.currency,
                        },
                    }
                    update(editingIndex, refreshed)
                    toast.success("Unidad actualizada")
                } else {
                    // CREATE new listing
                    const created = await listingsService.create(payload as any)
                    const apiData = created?.data ?? created ?? {}
                    const newListingUuid = apiData.uuid || created?.uuid
                    if (!newListingUuid) {
                        throw new Error("El backend creó la unidad sin devolver su UUID.")
                    }
                    const savedUnit = {
                        ...unitForm,
                        uuid: newListingUuid,
                        // Los `id` de las filas recién creadas vienen en la
                        // respuesta del POST; sin rehidratarlos, editar sin
                        // recargar la página fallaría con 422 (contrato §1).
                        externalPmsIds: readExternalPmsIds(apiData) ?? unitForm.externalPmsIds,
                        // Restore price checking root and extra
                        price: apiData.price || apiData.startPrice || apiData.start_price || apiData.extra?.price || apiData.extra?.startPrice || unitForm.price,
                        extra: {
                            ...unitForm.extra,
                            ...(apiData.extra || {}),
                            startPrice: Number(unitForm.price) || 0,
                            price: Number(unitForm.price) || 0,
                            currency:   apiData.extra?.currency || unitForm.extra.currency,
                        },
                    }
                    append(savedUnit)

                    // ── Requirement A: create override drafts sequentially after the listing ──
                    const drafts = Object.values(listingOverrides).filter(o => !o.uuid && isMeaningfulOverride(o))
                    if (newListingUuid && drafts.length > 0) {
                        const failed: string[] = []
                        for (const d of drafts) {
                            try {
                                await automationService.createListingOverride({
                                    listingUuid: newListingUuid,
                                    propertyAutomationUuid: d.propertyAutomationUuid,
                                    statusRecordId: d.statusRecordId,
                                    parameters: d.parameters,
                                    ...(d.token ? { token: d.token } : {}),
                                })
                            } catch {
                                failed.push(d.propertyAutomation?.name ?? d.propertyAutomationUuid)
                            }
                        }
                        if (failed.length > 0) {
                            toast.warning("Unidad creada, pero algunos overrides fallaron", {
                                description: `No se configuraron: ${failed.join(", ")}. Edita la unidad para reintentar.`,
                            })
                        } else {
                            toast.success("Unidad y overrides creados correctamente")
                        }
                    } else {
                        toast.success("Unidad creada correctamente")
                    }
                }
            } catch (err) {
                console.error("[PropertiesUnits] Error saving listing:", err)
                // 422 de identificadores: atribuir cada error a su fila (las
                // claves llegan como `externalIdentifiers.N.campo`); el mensaje
                // ya viene localizado y se muestra tal cual. Un error de `id`
                // (fila obsoleta) se ancla al campo visible de la fila.
                const identifierErrors = err instanceof ApiError
                    ? readExternalIdentifierServerErrors(err.errors)
                    : []
                if (identifierErrors.length > 0) {
                    const byRow: Record<number, { sourcePmsId?: string; externalId?: string }> = {}
                    for (const serverError of identifierErrors) {
                        const slot = serverError.field === "sourcePmsId" ? "sourcePmsId" : "externalId"
                        byRow[serverError.index] = { ...byRow[serverError.index], [slot]: serverError.message }
                    }
                    setServerIdentifierErrors(byRow)
                    setActiveTab("general")
                    toast.error("Revisa la identificación externa", {
                        description: identifierErrors[0].message,
                    })
                } else {
                    notifyError(err, "Error al guardar la unidad. Intenta de nuevo o guarda la propiedad completa.")
                }
                saveLockRef.current = false
                setIsSavingUnit(false)
                return
            }
        } else {
            // ── New property: keep in local form state, will be saved with the property ──
            if (editingIndex !== null) {
                update(editingIndex, unitForm)
            } else {
                append(unitForm)
            }
        }

        saveLockRef.current = false
        setIsSavingUnit(false)
        setIsDialogOpen(false)
    }

    const handleRemoveUnit = async (index: number) => {
        const unit = fields[index] as any
        if (propertyUuid && unit.uuid) {
            try {
                await listingsService.delete(unit.uuid)
                toast.success("Unidad eliminada")
            } catch (err) {
                console.error("[PropertiesUnits] Error deleting listing:", err)
                notifyError(err, "Error al eliminar la unidad")
                return
            }
        }
        remove(index)
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Building className="h-5 w-5 text-[var(--color-brand-purple)]" />
                            Alojamientos
                        </CardTitle>
                        <CardDescription>
                            Gestiona los alojamientos disponibles para reservar en esta propiedad.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleOpenAddDialog}
                        className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold px-4 rounded-lg shadow-sm transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Añadir Unidad
                    </Button>

                    <Dialog
                        open={isDialogOpen}
                        onOpenChange={(open) => {
                            if (!isSavingUnit) setIsDialogOpen(open)
                        }}
                    >
                        {/*
                          * `overflow-hidden` acompaña a `max-h-[90vh]`: sin él, cuando el
                          * contenido excedía la altura máxima no se recortaba, se PINTABA
                          * FUERA de la caja del diálogo. Con esto, cualquier regresión
                          * futura del scroll se ve como contenido cortado (evidente) en
                          * vez de campos flotando fuera del modal.
                          */}
                        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden p-0 sm:max-w-[600px]">
                            <DialogHeader className="p-6 pb-2 shrink-0">
                                <DialogTitle>{editingIndex !== null ? "Editar Unidad" : "Añadir Unidad"}</DialogTitle>
                                <DialogDescription>
                                    Configura los detalles del alojamiento.
                                </DialogDescription>
                            </DialogHeader>

                            {/*
                              * Contenedor de scroll NATIVO, no `ScrollArea` de Radix.
                              *
                              * Con `ScrollArea` el `min-h-0` sí limitaba su Root (medido:
                              * 494px en una ventana de 768), pero el Viewport de Radix es
                              * `size-full`, o sea `height: 100%`, y un porcentaje NO resuelve
                              * contra un padre cuya altura la fijó flexbox y no la propiedad
                              * `height`: el Viewport caía a `height: auto` y medía **824px
                              * siempre**, la altura del formulario completo. Consecuencia
                              * medida en Chrome: `scrollHeight === clientHeight`, así que no
                              * había nada que scrollear, Radix no montaba la barra, y el
                              * excedente se pintaba FUERA de la caja del diálogo —de ahí que
                              * en el reporte se vieran campos por debajo de los botones—. El
                              * correo de contacto, que es obligatorio, quedaba fuera del
                              * diálogo e inalcanzable: era imposible crear un alojamiento sin
                              * bajar el zoom del navegador.
                              *
                              * `overflow-hidden` en el Root (lo que trae el shadcn canónico)
                              * NO lo arregla: se comprobó y el Viewport sigue midiendo 824 —
                              * solo recortaría el desborde, dejando el campo igual de
                              * inalcanzable pero sin la pista visual.
                              *
                              * Un `div` con `overflow-y-auto` no depende de ningún porcentaje:
                              * `flex-1 min-h-0` le da la altura y el desbordamiento es suyo.
                              * De paso, en Windows la barra nativa se ve siempre, que es
                              * justo lo que faltaba para saber que había más formulario.
                              */}
                            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
                                <div className="space-y-6 pb-6">
                                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium">Estado del Alojamiento</Label>
                                            <p className="text-[10px] text-muted-foreground">Activar o desactivar esta unidad específica.</p>
                                        </div>
                                        <Switch
                                            checked={unitForm.isActive}
                                            onCheckedChange={(checked) => setUnitForm({ ...unitForm, isActive: checked })}
                                        />
                                    </div>

                                    <Tabs
                                        value={activeTab}
                                        onValueChange={(v) => setActiveTab(v as UnitFormTab | "automations")}
                                        className="w-full"
                                    >
                                        {/* AUTOM tab only exists once the property is saved — mirrors the
                                            property-level Automatización tab behavior */}
                                        <TabsList className={cn("grid mb-4", propertyUuid ? "grid-cols-5" : "grid-cols-4")}>
                                            <TabsTrigger value="general" className="text-[10px] uppercase font-bold">General</TabsTrigger>
                                            <TabsTrigger value="amenities" className="text-[10px] uppercase font-bold">Operación</TabsTrigger>
                                            <TabsTrigger value="rooms" className="text-[10px] uppercase font-bold">Distribución</TabsTrigger>
                                            <TabsTrigger value="policies" className="text-[10px] uppercase font-bold">Políticas</TabsTrigger>
                                            {propertyUuid && (
                                                <TabsTrigger value="automations" className="text-[10px] uppercase font-bold flex items-center gap-1">
                                                    <Zap className="h-3 w-3" />
                                                    Autom.
                                                </TabsTrigger>
                                            )}
                                        </TabsList>

                                        <TabsContent value="general" className="space-y-4">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="name">Nombre de Unidad <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        id="name"
                                                        placeholder="Suite Junior"
                                                        maxLength={UNIT_LIMITS.name}
                                                        aria-invalid={!!fieldErrors.name}
                                                        value={unitForm.name ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                                                    />
                                                    <FieldError message={fieldErrors.name} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="internalName">Nombre Interno / Número</Label>
                                                    <Input
                                                        id="internalName"
                                                        placeholder="Ej. SJ-101"
                                                        // Límite del backend (`internal_name`, 15). El más
                                                        // estrecho del recurso: "Apto 105 Insula" ya no cabe.
                                                        maxLength={UNIT_LIMITS.internalName}
                                                        aria-invalid={!!fieldErrors.internalName}
                                                        value={unitForm.internalName ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, internalName: e.target.value })}
                                                    />
                                                    <FieldError message={fieldErrors.internalName} />
                                                </div>
                                            </div>

                                            <div className="grid gap-2 border-t border-slate-100 pt-4">
                                                <div className="space-y-0.5">
                                                    <Label className="text-sm font-medium">Identificación Externa</Label>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Si este alojamiento ya existe en tu PMS o canal, registra su
                                                        origen y el ID que tiene allí.
                                                    </p>
                                                </div>
                                                <ExternalPmsIdsField
                                                    subject="alojamiento"
                                                    value={unitForm.externalPmsIds ?? []}
                                                    onChange={(next) => {
                                                        setUnitForm({ ...unitForm, externalPmsIds: next })
                                                        if (hasServerIdentifierErrors) setServerIdentifierErrors({})
                                                        // Clearing as they fix it: keeping stale red on a row the PM
                                                        // is already correcting reads as "still wrong".
                                                        if (showExternalPmsIdErrors) setShowExternalPmsIdErrors(false)
                                                    }}
                                                    rowErrors={externalPmsIdRowErrors}
                                                />
                                                {/* Quitar la última fila y guardar ES el borrado
                                                    (`externalPmsIds: []`, sin deshacer — contrato
                                                    2026-08-23): mismo aviso que el formulario de
                                                    propiedad, antes de pulsar guardar. */}
                                                {initialExternalPmsIdsRef.current.length > 0
                                                    && (unitForm.externalPmsIds ?? []).length === 0 && (
                                                    <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                                        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                                                        Al guardar se eliminarán los vínculos con el PMS/canal
                                                        y las reservas externas de esos orígenes dejarán de
                                                        asociarse a este alojamiento.
                                                    </p>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="roomTypeId">Categoría del Alojamiento</Label>
                                                    <Select
                                                        value={unitForm.roomTypeId ? String(unitForm.roomTypeId) : undefined}
                                                        onValueChange={(value) => setUnitForm({ ...unitForm, roomTypeId: parseInt(value) })}
                                                        disabled={roomTypesLoading || roomTypes.length === 0}
                                                    >
                                                        <SelectTrigger id="roomTypeId" aria-invalid={!!fieldErrors.roomTypeId}>
                                                            <SelectValue placeholder="Seleccionar tipo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {roomTypes.map(rt => (
                                                                <SelectItem key={rt.id} value={String(rt.id)}>{rt.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FieldError message={fieldErrors.roomTypeId} />
                                                    {!roomTypesLoading && roomTypes.length === 0 && (
                                                        <p className="flex items-start gap-1.5 text-xs text-amber-700">
                                                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                            No se pudo cargar el catálogo. Recarga la página antes de guardar.
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="maxOccupancy">Capacidad Máxima</Label>
                                                    <Input
                                                        id="maxOccupancy"
                                                        type="number"
                                                        min={1}
                                                        step={1}
                                                        aria-invalid={!!fieldErrors.maxOccupancy}
                                                        value={unitForm.extra.maxOccupancy ?? 2}
                                                        onChange={(e) => setUnitForm({ 
                                                            ...unitForm, 
                                                            extra: { ...unitForm.extra, maxOccupancy: parseInt(e.target.value) || 0 } 
                                                        })}
                                                    />
                                                    <FieldError message={fieldErrors.maxOccupancy} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="currency">Moneda</Label>
                                                    <Select
                                                        value={unitForm.extra.currency ?? "COP"}
                                                        onValueChange={(val) => setUnitForm({ ...unitForm, extra: { ...unitForm.extra, currency: val } })}
                                                    >
                                                        <SelectTrigger id="currency">
                                                            <SelectValue placeholder="COP" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {currencies.length > 0 ? (
                                                                currencies.map(c => (
                                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                                ))
                                                            ) : (
                                                                <>
                                                                    <SelectItem value="ARS">ARS - Argentine peso</SelectItem>
                                                                    <SelectItem value="CAD">CAD - Canadian dollar</SelectItem>
                                                                    <SelectItem value="CLP">CLP - Chilean peso</SelectItem>
                                                                    <SelectItem value="COP">COP - Colombian peso</SelectItem>
                                                                    <SelectItem value="USD">USD - United States dollar</SelectItem>
                                                                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                                                                    <SelectItem value="MXN">MXN - Mexican peso</SelectItem>
                                                                </>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="price">Precio Inicial por Noche</Label>
                                                    <Input
                                                        id="price"
                                                        type="number"
                                                        // `type="number"` por sí solo acepta negativos; el
                                                        // guardado hacía `Number(price) || 0` y publicaba la
                                                        // unidad sin precio en silencio.
                                                        min={0}
                                                        placeholder="250000"
                                                        aria-invalid={!!fieldErrors.price}
                                                        value={unitForm.price ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                                                    />
                                                    <FieldError message={fieldErrors.price} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactName">Nombre de Contacto</Label>
                                                    <Input
                                                        id="contactName"
                                                        placeholder="Nombre del encargado"
                                                        maxLength={UNIT_LIMITS.contactName}
                                                        aria-invalid={!!fieldErrors.contactName}
                                                        value={unitForm.contactName ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactName: e.target.value })}
                                                    />
                                                    <FieldError message={fieldErrors.contactName} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactPhone">Teléfono de Contacto</Label>
                                                    <Input
                                                        id="contactPhone"
                                                        placeholder="+57..."
                                                        maxLength={UNIT_LIMITS.contactPhone}
                                                        aria-invalid={!!fieldErrors.contactPhone}
                                                        value={unitForm.contactPhone ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactPhone: e.target.value })}
                                                    />
                                                    <FieldError message={fieldErrors.contactPhone} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactEmail">Correo Electrónico <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        id="contactEmail"
                                                        type="email"
                                                        placeholder="ejemplo@kunas.co"
                                                        maxLength={UNIT_LIMITS.contactEmail}
                                                        aria-invalid={!!fieldErrors.contactEmail}
                                                        value={unitForm.contactEmail ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactEmail: e.target.value })}
                                                    />
                                                    <FieldError message={fieldErrors.contactEmail} />
                                                </div>
                                            </div>


                                        </TabsContent>

                                        <TabsContent value="amenities" className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-[var(--color-brand-purple)]" />
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Horarios</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Heredar de Propiedad</span>
                                                        <Switch
                                                            checked={unitForm.extra.inheritSchedule}
                                                            onCheckedChange={(checked) => setUnitForm({ 
                                                                ...unitForm, 
                                                                extra: { ...unitForm.extra, inheritSchedule: checked } 
                                                            })}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {!unitForm.extra.inheritSchedule && (
                                                    <div className="grid grid-cols-1 gap-6 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                                                        <div className="space-y-3">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Check-in</p>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px]">Hora</Label>
                                                                    <Input 
                                                                        type="time" 
                                                                        value={unitForm.extra.checkIn ?? ""}
                                                                        onChange={(e) => setUnitForm({ 
                                                                            ...unitForm, 
                                                                            extra: { ...unitForm.extra, checkIn: e.target.value }
                                                                        })}
                                                                        className="h-8 text-xs"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3 border-l pl-6">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Check-out</p>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px]">Hora</Label>
                                                                    <Input 
                                                                        type="time"
                                                                        value={unitForm.extra.checkOut ?? ""}
                                                                        onChange={(e) => setUnitForm({ 
                                                                            ...unitForm, 
                                                                            extra: { ...unitForm.extra, checkOut: e.target.value }
                                                                        })}
                                                                        className="h-8 text-xs"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-4 pt-4 border-t">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Settings2 className="h-4 w-4 text-[var(--color-brand-purple)]" />
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">WiFi Especial</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Heredar de Propiedad</span>
                                                        <Switch
                                                            checked={unitForm.extra.inheritWifi}
                                                            onCheckedChange={(checked) => setUnitForm({ 
                                                                ...unitForm, 
                                                                extra: { ...unitForm.extra, inheritWifi: checked } 
                                                            })}
                                                        />
                                                    </div>
                                                </div>

                                                {!unitForm.extra.inheritWifi && (
                                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitWifiNetwork">Red WiFi Especial</Label>
                                                            <Input
                                                                id="unitWifiNetwork"
                                                                placeholder="Red específica"
                                                                value={unitForm.extra.wifiDetails?.network ?? ""}
                                                                onChange={(e) => setUnitForm({ 
                                                                    ...unitForm, 
                                                                    extra: { 
                                                                        ...unitForm.extra, 
                                                                        wifiDetails: { ...unitForm.extra.wifiDetails, network: e.target.value } 
                                                                    } 
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitWifiPassword">Clave WiFi Especial</Label>
                                                            <Input
                                                                id="unitWifiPassword"
                                                                placeholder="Clave específica"
                                                                value={unitForm.extra.wifiDetails?.password ?? ""}
                                                                onChange={(e) => setUnitForm({ 
                                                                    ...unitForm, 
                                                                    extra: { 
                                                                        ...unitForm.extra, 
                                                                        wifiDetails: { ...unitForm.extra.wifiDetails, password: e.target.value } 
                                                                    } 
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="rooms" className="space-y-6">
                                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/30">
                                                    <div className="flex items-center gap-2">
                                                        <BedDouble className="h-4 w-4 text-primary" />
                                                        <h4 className="text-xs font-bold uppercase text-slate-600">Dormitorios</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Cant. Habitaciones / Camas</Label>
                                                            <Input 
                                                                id="bedRoom"
                                                                type="number" 
                                                                min={1}
                                                                step={1}
                                                                aria-invalid={!!fieldErrors.bedRoom}
                                                                value={unitForm.extra.bedRoom ?? 1}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bedRoom: parseInt(e.target.value) || 1 }
                                                                })}
                                                            />
                                                            <FieldError message={fieldErrors.bedRoom} />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/30">
                                                    <div className="flex items-center gap-2">
                                                        <Bath className="h-4 w-4 text-primary" />
                                                        <h4 className="text-xs font-bold uppercase text-slate-600">Baños</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Cantidad</Label>
                                                            <Input 
                                                                id="bathRoom"
                                                                type="number" 
                                                                min={1}
                                                                step={1}
                                                                aria-invalid={!!fieldErrors.bathRoom}
                                                                value={unitForm.extra.bathRoom ?? 1}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bathRoom: parseInt(e.target.value) || 1 }
                                                                })}
                                                            />
                                                            <FieldError message={fieldErrors.bathRoom} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="policies" className="space-y-4">
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Shield className="h-4 w-4 text-[var(--color-brand-purple)]" />
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Políticas</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Heredar de Propiedad</span>
                                                        <Switch
                                                            checked={unitForm.extra.inheritPolicies}
                                                            onCheckedChange={(checked) => setUnitForm({ 
                                                                ...unitForm, 
                                                                extra: { ...unitForm.extra, inheritPolicies: checked } 
                                                            })}
                                                        />
                                                    </div>
                                                </div>

                                                {unitForm.extra.inheritPolicies ? (
                                                    <div className="bg-[var(--color-brand-purple)]/5 border border-[var(--color-brand-purple)]/10 rounded-xl p-4 flex gap-3">
                                                        <Shield className="h-5 w-5 text-[var(--color-brand-purple)] shrink-0 mt-0.5" />
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-bold text-[var(--color-brand-purple)]">Políticas del Tipo de Alojamiento</p>
                                                            <p className="text-xs text-[var(--color-brand-purple)]/80 leading-relaxed">
                                                                Este tipo de habitación heredará las políticas generales de la propiedad. Puedes definir políticas específicas o excepciones en la integración final.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-50 p-4 rounded-xl border space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Política de Cancelación Específica</Label>
                                                            <Select 
                                                                value={unitForm.extra.cancellationPolicy ?? ""}
                                                                onValueChange={(val) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, cancellationPolicy: val }
                                                                })}
                                                            >
                                                                <SelectTrigger className="h-10 text-xs">
                                                                    <SelectValue placeholder="Selecciona una política (Ej: Flexible)" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="FLEXIBLE">Flexible (Reembolso completo hasta 24h antes)</SelectItem>
                                                                    <SelectItem value="MODERATE">Moderada (Reembolso completo hasta 5 días antes)</SelectItem>
                                                                    <SelectItem value="STRICT_14">Estricta (Reembolso completo hasta 14 días antes)</SelectItem>
                                                                    <SelectItem value="NON_REFUNDABLE">No Reembolsable</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        {/* ── Automations Overrides Tab (only when the property is saved) ── */}
                                        {propertyUuid && (
                                        <TabsContent value="automations" className="space-y-4">
                                            <div className="flex items-start gap-3 bg-primary/10 border border-primary/20 rounded-xl p-4">
                                                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">Sobreescribir automatizaciones</p>
                                                    <p className="text-xs text-primary leading-relaxed">
                                                        Puedes desactivar o cambiar parámetros específicos para esta unidad. El resto hereda la configuración de la propiedad.
                                                    </p>
                                                </div>
                                            </div>

                                            {overridesLoading ? (
                                                <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span className="text-sm">Cargando automatizaciones...</span>
                                                </div>
                                            ) : propertyAutomations.length === 0 ? (
                                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                    <Zap className="h-4 w-4 text-slate-400 shrink-0" />
                                                    <p className="text-sm text-slate-500">
                                                        No hay automatizaciones activas en esta propiedad.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {!(unitForm as any).uuid && (
                                                        <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                            Configura los overrides ahora; se crearán automáticamente al guardar la unidad.
                                                        </p>
                                                    )}
                                                    {propertyAutomations.map((automation) => {
                                                        const slug = automation.provider?.parameters?.slug ?? automation.providerName ?? ""
                                                        const schema = getOverrideFieldSchema(slug)
                                                        const override = listingOverrides[automation.uuid]
                                                        const hasOverride = !!override
                                                        const isInactive = hasOverride && !override.isActive
                                                        const params = override?.parameters ?? {}
                                                        const hasParams = hasOverride && override.isActive &&
                                                            Object.values(params).some(v => v !== "" && v !== null && v !== undefined)
                                                        const hasToken = hasOverride && override.token != null

                                                        return (
                                                            <div key={automation.uuid} className={cn(
                                                                "border rounded-xl p-4 flex items-center justify-between gap-3 transition-all duration-200",
                                                                isInactive
                                                                    ? "border-red-200 bg-red-50/40"
                                                                    : hasParams
                                                                        ? "border-primary/20 bg-primary/5"
                                                                        : "border-slate-200 bg-slate-50/30"
                                                            )}>
                                                                <div className="min-w-0 space-y-0.5">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <Settings2 className="h-4 w-4 text-slate-400 shrink-0" />
                                                                        <span className="text-sm font-bold text-slate-800 truncate">{automation.name}</span>
                                                                        {slug && <span className="text-[10px] text-slate-400">{slug}</span>}
                                                                        {isInactive && (
                                                                            <Badge variant="outline" className="text-[9px] h-4 bg-red-50 text-red-600 border-red-200 uppercase font-bold">
                                                                                Desactivada aquí
                                                                            </Badge>
                                                                        )}
                                                                        {hasParams && (
                                                                            <Badge variant="outline" className="text-[9px] h-4 bg-primary/10 text-primary border-primary/20 uppercase font-bold">
                                                                                Personalizada
                                                                            </Badge>
                                                                        )}
                                                                        {hasToken && (
                                                                            <Badge variant="outline" className="text-[9px] h-4 bg-slate-100 text-slate-600 border-slate-200 uppercase font-bold">
                                                                                Token
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-500">
                                                                        {hasParams
                                                                            ? schema.filter(f => params[f.key] != null && params[f.key] !== "").map(f => f.key).join(", ") || "Parámetros sobreescritos"
                                                                            : isInactive
                                                                                ? "La automatización se omite para esta unidad."
                                                                                : "Hereda la configuración de la propiedad."}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="shrink-0"
                                                                    onClick={() => setEditingOverrideAutomation(automation)}
                                                                >
                                                                    {hasOverride ? "Editar" : "Configurar"}
                                                                </Button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </TabsContent>
                                        )}

                                    </Tabs>
                                </div>
                            </div>

                            {/*
                              * `shrink-0` es la contraparte del header, que ya lo tiene.
                              * Sin él, el footer es el ÚNICO ítem encogible de la columna
                              * flex: en un viewport bajo el navegador le quita altura para
                              * que el diálogo quepa en `max-h-[90vh]`, y los botones se
                              * comprimen contra el último campo del formulario en vez de
                              * quedar en su propia banda. Con esto, el que cede es el área
                              * de scroll, que para eso está.
                              */}
                            <DialogFooter className="p-6 border-t bg-muted/5 shrink-0">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSavingUnit}>Cancelar</Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveUnit}
                                    disabled={isSavingUnit || roomTypesLoading || roomTypes.length === 0}
                                    className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold"
                                >
                                    {isSavingUnit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {editingIndex !== null ? "Guardar Cambios" : "Añadir Unidad"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Override create/edit modal (live for saved listings, draft otherwise) */}
                    {editingOverrideAutomation && (
                        <AutomationOverrideModal
                            open={!!editingOverrideAutomation}
                            onClose={() => setEditingOverrideAutomation(null)}
                            listingUuid={(unitForm as any).uuid ?? ""}
                            listingName={unitForm.name}
                            propertyAutomations={propertyAutomations}
                            override={listingOverrides[editingOverrideAutomation.uuid] ?? null}
                            lockedPropertyAutomationUuid={editingOverrideAutomation.uuid}
                            draftMode={!(unitForm as any).uuid}
                            onSaved={(saved) => {
                                setListingOverrides(prev => ({ ...prev, [editingOverrideAutomation.uuid]: saved }))
                                setEditingOverrideAutomation(null)
                            }}
                        />
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">ID / Núm</TableHead>
                            <TableHead>Nombre / Alojamiento</TableHead>
                            <TableHead>Capacidad</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="w-[100px] text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                    Aún no hay unidades. Haz clic en "Añadir Unidad" para crear una.
                                </TableCell>
                            </TableRow>
                        ) : (
                            fields.map((field: any, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-bold text-[var(--color-brand-purple)]">{field.internalName || field.internal_name || '-'}</TableCell>
                                    <TableCell className="font-medium text-slate-900">{field.name || 'Unidad sin nombre'}</TableCell>
                                    <TableCell className="text-sm">
                                        {field.extra?.maxOccupancy || field.extra?.max_occupancy || 0} Huéspedes
                                    </TableCell>
                                    <TableCell>
                                        <div className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            field.isActive !== false
                                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                : "bg-slate-100 text-slate-500 border border-slate-200"
                                        )}>
                                            {field.isActive !== false ? "Activo" : "Inactivo"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-slate-700">
                                        ${Number(field.price || field.extra?.startPrice || field.extra?.price || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1 flex justify-end">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenEditDialog(index)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveUnit(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
