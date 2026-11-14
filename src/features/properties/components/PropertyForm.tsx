"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2, LayoutDashboard, MapPin, Building, Camera, Sparkles, Info, AlertCircle, FileText, Link2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { useState, useEffect, useRef } from "react"
import { Surface, Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Heading } from "@/components/ui/heading"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PropertiesLocation } from "./PropertiesLocation"
import { PropertiesUnits } from "./PropertiesUnits"
import { PropertiesPhotos } from "./PropertiesPhotos"
import { PropertiesAmenities } from "./PropertiesAmenities"
import { PropertiesAutomation } from "./PropertiesAutomation"
import { PropertiesDocuments } from "./documents"
import { ExternalPmsIdsField } from "./ExternalPmsIdsField"
import { propertyFormSchema, PropertyFormData, type PropertyApiResponse } from "../types"
import { propertiesService } from "../services/properties-service"
import { listingsService } from "../services/listings-service"
import { toListingPayload, type ListingDraft } from "../lib/listing-payload"
import { readExternalIdentifierServerErrors } from "../lib/external-pms-ids"
import { ApiError } from "@/types/api"
import { RECORD_STATUS, readRecordStatus } from "../lib/record-status"
import { DeactivationConfirmDialog } from "./DeactivationConfirmDialog"
import { invalidatePropertiesCaches } from "../lib/properties-cache"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { COMMUNICATION_LOCALES, LOCALE_LABELS, DEFAULT_COMMUNICATION_LOCALE } from "@/lib/locales"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { isPropertyTab, propertyEditHref } from "../lib/property-tabs"

interface PropertyFormProps {
    initialData?: any
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const submitLockRef = useRef(false)
    const [propertyTypes, setPropertyTypes] = useState<CatalogOption[]>([])
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true)

    useEffect(() => {
        async function loadCatalogs() {
            try {
                const [propertyTypesData] = await Promise.all([
                    catalogService.getPropertyTypes()
                ])
                setPropertyTypes(propertyTypesData)
            } finally {
                setIsLoadingCatalogs(false)
            }
        }
        loadCatalogs()
    }, [])
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isValidationErrorOpen, setIsValidationErrorOpen] = useState(false)
    // Guardado en espera de que el PM confirme que desactiva la propiedad.
    const [pendingDeactivation, setPendingDeactivation] = useState<PropertyFormData | null>(null)
    const [validationErrors, setValidationErrors] = useState<{ label: string; tab: string; message: string }[]>([])
    const [activeTab, setActiveTab] = useState("details")
    const [statusRecords, setStatusRecords] = useState<CatalogOption[]>([])
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        // Solo una pestaña que existe: un `?tab=` desconocido abría el formulario vacío.
        const tab = searchParams.get("tab")
        if (isPropertyTab(tab)) {
            setActiveTab(tab)
        }
    }, [searchParams])

    useEffect(() => {
        const fetchCatalogs = async () => {
            try {
                const [statuses] = await Promise.all([
                    catalogService.getStatusRecords()
                ])
                if (statuses.length > 0) setStatusRecords(statuses)
            } catch (error) {
                console.error("[PropertyForm] Error fetching calendars/statuses:", error)
                // Sin respaldo inventado: los ids 1/2 que había acá no existen en
                // el catálogo real (6 activo, 7 inactivo) y podían guardarse.
                setStatusRecords([])
            }
        }
        fetchCatalogs()
    }, [])

    const form = useForm<PropertyFormData>({
        resolver: zodResolver(propertyFormSchema) as any,
        defaultValues: (initialData ? { ...initialData, uuid: initialData.uuid } : {
            name: "",
            description: "",
            email: "",
            phone: "",
            address: "",
            addressDetail: "",
            city: "",
            state: "",
            countryId: 0,
            latitude: 0,
            longitude: 0,
            statusRecordId: 6,
            // Sin default: el PM elige. 102 no es «Apartamento», es Hotel en el catálogo real.
            propertyTypeId: 0,
            communicationsLocale: DEFAULT_COMMUNICATION_LOCALE,
            amenities: [],
            wifiNetwork: "",
            wifiPassword: "",
            picturesUrl: [],
            thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
            units: [],
            externalPmsIds: [],
            policies: [],
            roomTypes: [],
            automationSettings: {
                welcome_message: true,
                checkin_instructions: true,
                digital_key: false,
                online_checkin: true,
                cleaning_task: true,
            },
        } as any),
    })

    // Reset form when initialData arrives from async fetch
    // Preserve uuid so child components can watch('uuid') to know they are in edit mode
    useEffect(() => {
        if (initialData) {
            const transformedData = { ...initialData, uuid: initialData.uuid }
            form.reset(transformedData)
        }
    }, [initialData, form])

    // zod reports an incomplete row on `externalPmsIds.<i>.<field>`, never on
    // `externalPmsIds` itself — so a <FormMessage/> on the array field renders
    // nothing and the row stays silently red-less. Fan the messages back out to
    // the row that owns them.
    const externalPmsIdErrors = form.formState.errors.externalPmsIds
    const externalPmsIdRowErrors = Array.isArray(externalPmsIdErrors)
        ? externalPmsIdErrors.map((rowError) => ({
            sourcePmsId: rowError?.sourcePmsId?.message,
            externalId: rowError?.externalId?.message,
        }))
        : undefined

    // Field → friendly label + tab where the user can fix it
    const FIELD_META: Record<string, { label: string; tab: string }> = {
        name:           { label: "Nombre de la propiedad", tab: "Detalles" },
        email:          { label: "Email de contacto",      tab: "Detalles" },
        phone:          { label: "Teléfono",               tab: "Detalles" },
        propertyTypeId: { label: "Tipo de propiedad",      tab: "Detalles" },
        statusRecordId: { label: "Estado",                 tab: "Detalles" },
        externalPmsIds: { label: "Identificación externa", tab: "Detalles" },
        description:    { label: "Descripción",            tab: "Detalles" },
        thumbnailUrl:   { label: "URL de miniatura",       tab: "Detalles" },
        address:        { label: "Dirección",              tab: "Ubicación" },
        addressDetail:  { label: "Detalle de dirección",   tab: "Ubicación" },
        city:           { label: "Ciudad",                 tab: "Ubicación" },
        state:          { label: "Estado / Departamento",  tab: "Ubicación" },
        countryId:      { label: "País",                   tab: "Ubicación" },
        latitude:       { label: "Latitud",                tab: "Ubicación" },
        longitude:      { label: "Longitud",               tab: "Ubicación" },
        timezone:       { label: "Zona horaria",           tab: "Ubicación" },
        units:          { label: "Unidades",               tab: "Unidades" },
        picturesUrl:    { label: "Fotos",                  tab: "Fotos" },
    }

    /**
     * An array field's error has no `message` of its own — the real one sits on
     * the offending row (`externalPmsIds.0.externalId`). Without this, the dialog
     * showed the generic "Campo obligatorio o inválido" for those fields.
     */
    function firstMessage(err: unknown): string | undefined {
        if (!err || typeof err !== "object") return undefined

        const direct = (err as { message?: string }).message
        if (direct) return direct

        if (Array.isArray(err)) {
            for (const row of err as Record<string, { message?: string } | undefined>[]) {
                for (const nested of Object.values(row ?? {})) {
                    if (nested?.message) return nested.message
                }
            }
        }
        return undefined
    }

    function onInvalid(errors: Record<string, any>) {
        const items = Object.entries(errors).map(([field, err]) => {
            const meta = FIELD_META[field] ?? { label: field, tab: "Detalles" }
            return {
                label: meta.label,
                tab: meta.tab,
                message: firstMessage(err) || "Campo obligatorio o inválido",
            }
        })
        setValidationErrors(items)
        setIsValidationErrorOpen(true)
    }

    /**
     * Pasar una propiedad existente de activa a inactiva pide confirmación
     * antes de guardar: detiene todas las automatizaciones de sus reservas.
     * Un estado inicial desconocido también pregunta (avisar de más es seguro).
     */
    async function onSubmit(values: PropertyFormData) {
        const deactivating = !!initialData?.uuid
            && readRecordStatus(initialData) !== "inactive"
            && Number(values.statusRecordId) !== RECORD_STATUS.ACTIVE
        if (deactivating) {
            setPendingDeactivation(values)
            return
        }
        await saveProperty(values)
    }

    async function saveProperty(values: PropertyFormData) {
        if (submitLockRef.current) return
        submitLockRef.current = true
        setIsLoading(true)
        try {
            let propertyUuid = initialData?.uuid

            // Contrato 2026-08-23: `externalPmsIds: []` BORRA todas las filas y
            // la clave omitida no toca nada. Solo viaja si el PM editó la
            // sección — mandarla siempre convertía cualquier guardado en un
            // borrado potencial (o en un 422 al reenviar filas sin editar).
            const submitValues: PropertyFormData = form.formState.dirtyFields.externalPmsIds
                ? values
                : { ...values, externalPmsIds: undefined }

            if (propertyUuid) {
                await propertiesService.update(propertyUuid, submitValues)
                invalidatePropertiesCaches()
                toast.success("Propiedad actualizada")
                router.push("/dashboard/properties")
            } else {
                const response = await propertiesService.create(submitValues)
                invalidatePropertiesCaches()
                const responseWithEnvelope = response as PropertyApiResponse & { data?: PropertyApiResponse }
                propertyUuid = response.uuid || responseWithEnvelope.data?.uuid
                if (!propertyUuid) {
                    throw new Error("El backend creó la propiedad sin devolver su UUID.")
                }
                // Restore manual creation: units MUST be created via separate /listings endpoint
                const pendingUnits = (values.units ?? []) as ListingDraft[]
                const failedUnits: string[] = []
                for (const [index, unit] of pendingUnits.entries()) {
                    try {
                        // Sequential on purpose: this endpoint also creates related
                        // records and the API does not document bulk/rate semantics.
                        // Sin identificadores no se manda la clave (contrato
                        // 2026-08-23: presencia = intención).
                        await listingsService.create(toListingPayload(propertyUuid, {
                            ...unit,
                            externalPmsIds: unit.externalPmsIds?.length ? unit.externalPmsIds : undefined,
                        }))
                    } catch (unitError) {
                        console.error("[PropertyForm] Error creating listing:", unitError)
                        failedUnits.push(String(unit.name || `Unidad ${index + 1}`))
                    }
                }

                if (failedUnits.length > 0) {
                    toast.warning("Propiedad creada con alojamientos pendientes", {
                        description: `No se pudieron crear: ${failedUnits.join(", ")}. Agrégalos nuevamente desde la propiedad.`,
                    })
                } else {
                    toast.success(
                        pendingUnits.length > 0
                            ? `Propiedad y ${pendingUnits.length} alojamiento(s) creados`
                            : "Propiedad creada",
                    )
                }
                // A partial listing failure needs a visible recovery destination.
                router.push(propertyEditHref(propertyUuid, failedUnits.length ? "units" : "automations"))
            }
        } catch (error) {
            console.error("[PropertyForm] Save error:", error)
            // 422 de identificadores: las claves llegan como
            // `externalIdentifiers.N.campo` (tercer nombre del mismo dato) y se
            // atribuyen a la fila real del formulario — el mensaje viene ya
            // localizado y se muestra tal cual. Un error de `id` (fila obsoleta)
            // se ancla al campo visible de esa fila.
            const identifierErrors = error instanceof ApiError
                ? readExternalIdentifierServerErrors(error.errors)
                : []
            if (identifierErrors.length > 0) {
                for (const serverError of identifierErrors) {
                    const field = serverError.field === "sourcePmsId" ? "sourcePmsId" : "externalId"
                    form.setError(
                        `externalPmsIds.${serverError.index}.${field}` as Parameters<typeof form.setError>[0],
                        { type: "server", message: serverError.message },
                    )
                }
                setActiveTab("details")
                toast.error("Revisa la identificación externa", {
                    description: identifierErrors[0].message,
                })
            } else {
                notifyError(error, "Hubo un problema al intentar guardar los cambios.")
            }
            submitLockRef.current = false
            setIsLoading(false)
        }
    }

    async function onDelete() {
        if (!initialData?.uuid) return
        setIsDeleting(true)
        try {
            await propertiesService.delete(initialData.uuid)
            invalidatePropertiesCaches()
            toast.success("Propiedad eliminada", {
                description: "La propiedad ha sido eliminada exitosamente.",
            })
            router.push("/dashboard/properties")
        } catch (error) {
            notifyError(error, "Hubo un problema al intentar eliminar la propiedad.")
        } finally {
            setIsDeleting(false)
            setIsDeleteDialogOpen(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="space-y-6">
                    {/* Pestañas estándar (las de Operaciones): la pantalla solo pone la grilla. */}
                    <TabsList className={cn(
                        "grid w-full",
                        initialData
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
                            : "grid-cols-2 md:grid-cols-2 lg:grid-cols-4"
                    )}>
                        <TabsTrigger value="details">
                            <Icon icon={Info} />
                            Detalles
                        </TabsTrigger>
                        <TabsTrigger value="units">
                            <Icon icon={Building} />
                            Alojamientos
                        </TabsTrigger>
                        {initialData && (
                            <TabsTrigger value="automations">
                                <Icon icon={Sparkles} />
                                Automatización
                            </TabsTrigger>
                        )}
                        {initialData && (
                            <TabsTrigger value="documents">
                                <Icon icon={FileText} />
                                Documentos
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="location">
                            <Icon icon={MapPin} />
                            Ubicación
                        </TabsTrigger>
                        <TabsTrigger value="photos">
                            <Icon icon={Camera} />
                            Fotos
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader divided>
                                <Heading level={2} size="title" className="flex items-center gap-2">
                                    <Icon icon={LayoutDashboard} size="lg" className="text-primary" />
                                    Detalles de la Propiedad
                                </Heading>
                                <CardDescription>
                                    Información básica y administrativa de la propiedad.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                {/*
                                  * `internal_name` es exclusivo de los Listings: el backend no
                                  * lo acepta en el `extra` de una propiedad. El campo se quitó
                                  * de esta vista para no ofrecer un dato que nunca se guarda.
                                  */}
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre de la Propiedad <span className="text-danger">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Hotel Oasis" {...field} />
                                            </FormControl>
                                            <FormDescription>El nombre comercial que verán los huéspedes.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email de Contacto <span className="text-danger">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="info@hotel.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Teléfono</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="+57 ..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="propertyTypeId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tipo de Propiedad <span className="text-danger">*</span></FormLabel>
                                                <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar tipo de propiedad" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {isLoadingCatalogs ? (
                                                            <SelectItem value="__loading" disabled>
                                                                Cargando tipos…
                                                            </SelectItem>
                                                        ) : propertyTypes.length > 0 ? (
                                                            propertyTypes.map(t => (
                                                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                            ))
                                                        ) : (
                                                            // Sin catálogo no hay ids válidos que ofrecer: los que
                                                            // estaban fijos acá no coincidían con el catálogo real.
                                                            <SelectItem value="__unavailable" disabled>
                                                                No se pudo cargar el catálogo de tipos
                                                            </SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="statusRecordId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estado <span className="text-danger">*</span></FormLabel>
                                                <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar estado" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {statusRecords.length > 0 ? (
                                                            statusRecords.map(s => (
                                                                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                            ))
                                                        ) : (
                                                            <SelectItem value="__unavailable" disabled>
                                                                No se pudo cargar el catálogo de estados
                                                            </SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="thumbnailUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>URL de Miniatura (Thumbnail)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="https://..." {...field} value={field.value || ""} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="communicationsLocale"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Idioma de Comunicaciones</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || DEFAULT_COMMUNICATION_LOCALE}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar idioma" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {COMMUNICATION_LOCALES.map((loc) => (
                                                            <SelectItem key={loc} value={loc}>{LOCALE_LABELS[loc]}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>Idioma de los correos al huésped (link de check-in, etc.).</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descripción</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Una hermosa propiedad..." className="min-h-25" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader divided>
                                <Heading level={2} size="title" className="flex items-center gap-2">
                                    <Icon icon={Link2} size="lg" className="text-primary" />
                                    Identificación Externa
                                </Heading>
                                <CardDescription>
                                    Si esta propiedad ya existe en tu PMS o en un canal, registra
                                    aquí su origen y el ID que tiene allí. Es lo que permite asociar
                                    sus reservas externas cuando la propiedad se creó manualmente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <FormField
                                    control={form.control}
                                    name="externalPmsIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <ExternalPmsIdsField
                                                subject="propiedad"
                                                value={field.value ?? []}
                                                onChange={field.onChange}
                                                rowErrors={externalPmsIdRowErrors}
                                            />
                                            {/* Quitar la última fila y guardar ES el borrado
                                                (`externalPmsIds: []`, sin deshacer): se avisa
                                                antes de que el PM pulse guardar, no después. */}
                                            {(initialData?.externalPmsIds?.length ?? 0) > 0
                                                && form.formState.dirtyFields.externalPmsIds
                                                && (field.value ?? []).length === 0 && (
                                                // Aparece al vaciar el campo: dinámico, se anuncia sin interrumpir.
                                                <FeedbackBanner tone="warning" mode="dynamic" className="mt-3">
                                                    Al guardar se eliminarán los vínculos con el PMS/canal
                                                    y las reservas externas de esos orígenes dejarán de
                                                    asociarse a esta propiedad.
                                                </FeedbackBanner>
                                            )}
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <PropertiesAmenities />
                    </TabsContent>

                    <TabsContent value="location" className="space-y-4">
                        <PropertiesLocation />
                    </TabsContent>

                    <TabsContent value="units" className="space-y-4">
                        <PropertiesUnits />
                    </TabsContent>

                    <TabsContent value="photos" className="space-y-4">
                        <PropertiesPhotos />
                    </TabsContent>

                    {initialData && (
                        <TabsContent value="automations" className="space-y-4">
                            <PropertiesAutomation onNavigateToDocuments={() => setActiveTab("documents")} />
                        </TabsContent>
                    )}

                    {initialData && (
                        <TabsContent value="documents" className="space-y-4">
                            <PropertiesDocuments />
                        </TabsContent>
                    )}
                </Tabs>

                <div className="flex justify-between items-center">
                    {initialData ? (
                        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="outline-destructive">
                                    <Icon icon={Trash2} className="mr-2" />
                                    Eliminar Propiedad
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>¿Estás completamente seguro?</DialogTitle>
                                    <DialogDescription>
                                        Esta acción no se puede deshacer. Esto eliminará permanentemente la propiedad
                                        y todos sus datos asociados.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                                        Cancelar
                                    </Button>
                                    <Button variant="destructive" onClick={onDelete} loading={isDeleting}>
                                        Confirmar Eliminación
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    ) : <div />}

                    <Button size="lg" type="submit" loading={isLoading}>
                        {initialData ? "Actualizar Propiedad" : "Crear Propiedad"}
                    </Button>
                </div>
            </form>

            <DeactivationConfirmDialog
                target={pendingDeactivation ? { kind: "property", name: pendingDeactivation.name || initialData?.name || "esta propiedad", uuid: initialData?.uuid } : null}
                onConfirm={() => {
                    const values = pendingDeactivation
                    setPendingDeactivation(null)
                    if (values) void saveProperty(values)
                }}
                onCancel={() => setPendingDeactivation(null)}
            />

            <Dialog open={isValidationErrorOpen} onOpenChange={setIsValidationErrorOpen}>
                <DialogContent className="sm:max-w-110">
                    <DialogHeader>
                        <div className="flex items-center gap-3 text-danger mb-2">
                            <Icon icon={AlertCircle} size="xl" />
                            <DialogTitle>Información Faltante</DialogTitle>
                        </div>
                        <DialogDescription className="text-ink-2">
                            Completa los siguientes campos para poder guardar la propiedad:
                        </DialogDescription>
                    </DialogHeader>
                    <Surface tone="sunk" className="my-2 max-h-64 overflow-y-auto p-4">
                        <ul className="space-y-2.5">
                            {validationErrors.map((err, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-ink leading-tight">
                                            {err.label}
                                            <Badge tone="neutral" className="ml-2">{err.tab}</Badge>
                                        </p>
                                        <p className="text-xs text-ink-3">{err.message}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Surface>
                    <DialogFooter>
                        <Button 
                            className="w-full"
                            onClick={() => {
                                setIsValidationErrorOpen(false)
                                // Jump to the tab of the first missing field
                                const firstTab = validationErrors[0]?.tab
                                if (firstTab === "Ubicación") setActiveTab("location")
                                else if (firstTab === "Unidades") setActiveTab("units")
                                else if (firstTab === "Fotos") setActiveTab("photos")
                                else setActiveTab("details")
                            }}
                        >
                            Entendido, voy a revisar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Form>
    )
}
