"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Badge } from "@/components/ui/badge"
import { useRouter, useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
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
import { useCallback, useEffect, useRef, useState } from "react"
import { SectionCard } from "@/components/ui/section-card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormActionBar } from "@/components/ui/form-action-bar"
import { CatalogError } from "@/components/shared/catalog-error"
import { PropertiesLocation } from "./PropertiesLocation"
import { PropertiesUnits } from "./PropertiesUnits"
import { PropertiesPhotos } from "./PropertiesPhotos"
import { PropertiesAmenities } from "./PropertiesAmenities"
import { PropertiesAutomation } from "./PropertiesAutomation"
import { PropertiesDocuments } from "./documents"
import { ExternalPmsIdsField } from "./ExternalPmsIdsField"
import { propertyFormSchema, PropertyFormData } from "../types"
import { propertiesService } from "../services/properties-service"
import { listingsService } from "../services/listings-service"
import { createPropertyWithUnits, tabAfterCreate, withExternalIdsGating } from "../lib/property-save"
import { DEFAULT_PROPERTY_THUMBNAIL_URL } from "../lib/property-defaults"
import { readExternalIdentifierServerErrors } from "../lib/external-pms-ids"
import { ApiError } from "@/types/api"
import { RECORD_STATUS, readRecordStatus } from "../lib/record-status"
import { DeactivationConfirmDialog } from "./DeactivationConfirmDialog"
import { invalidatePropertiesCaches } from "../lib/properties-cache"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { COMMUNICATION_LOCALES, LOCALE_LABELS, DEFAULT_COMMUNICATION_LOCALE } from "@/lib/locales"
import { FeedbackBanner } from "@/components/ui/feedback-banner"
import { isPropertyTab, propertyEditHref, type PropertyTab } from "../lib/property-tabs"
import { RequiredMark } from "@/components/shared/required-mark"
import { PROPERTY_FIELD_META, countErrorsByTab, orphanErrorMessages, TAB_LABELS, type FormTabId } from "../lib/property-form-errors"

interface PropertyFormProps {
    initialData?: any
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const isCreate = !initialData?.uuid
    const [isLoading, setIsLoading] = useState(false)
    const submitLockRef = useRef(false)
    const [propertyTypes, setPropertyTypes] = useState<CatalogOption[]>([])
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true)
    const [propertyTypesFailed, setPropertyTypesFailed] = useState(false)
    const [statusRecords, setStatusRecords] = useState<CatalogOption[]>([])
    const [isLoadingStatuses, setIsLoadingStatuses] = useState(true)
    const [statusesFailed, setStatusesFailed] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    // Tras un envío inválido: el aviso con el conteo por pestaña (se recalcula en vivo).
    const [showErrorSummary, setShowErrorSummary] = useState(false)
    // Guardado en espera de que el PM confirme que desactiva la propiedad.
    const [pendingDeactivation, setPendingDeactivation] = useState<PropertyFormData | null>(null)
    const [activeTab, setActiveTab] = useState<PropertyTab>("details")
    const router = useRouter()
    const searchParams = useSearchParams()

    // Orden del trabajo: Detalles → Ubicación → Alojamientos → Fotos; al editar, además
    // Automatización → Documentos (se guardan solas). Las claves y los `?tab=` no cambian.
    const availableTabs: PropertyTab[] = isCreate
        ? ["details", "location", "units", "photos"]
        : ["details", "location", "units", "photos", "automations", "documents"]

    // Un catálogo que falla se dice junto a su campo, con «Reintentar»: sin tipo o sin
    // estado no hay ids válidos que ofrecer (los que estaban fijos acá no coincidían con
    // el catálogo real).
    // Cadenas `.then()` a propósito: `react-hooks/set-state-in-effect` sigue las
    // llamadas a funciones locales y solo acepta setState dentro de callbacks.
    const fetchPropertyTypes = useCallback(() =>
        catalogService.getPropertyTypes()
            .then((data) => {
                setPropertyTypes(data)
                setPropertyTypesFailed(data.length === 0)
            })
            .catch((error) => {
                console.error("[PropertyForm] Error fetching property types:", error)
                setPropertyTypes([])
                setPropertyTypesFailed(true)
            })
            .finally(() => setIsLoadingCatalogs(false)), [])

    const fetchStatusRecords = useCallback(() =>
        catalogService.getStatusRecords()
            .then((statuses) => {
                setStatusRecords(statuses)
                setStatusesFailed(statuses.length === 0)
            })
            .catch((error) => {
                console.error("[PropertyForm] Error fetching calendars/statuses:", error)
                // Sin respaldo inventado: los ids 1/2 que había acá no existen en
                // el catálogo real (6 activo, 7 inactivo) y podían guardarse.
                setStatusRecords([])
                setStatusesFailed(true)
            })
            .finally(() => setIsLoadingStatuses(false)), [])

    useEffect(() => {
        void fetchPropertyTypes()
        void fetchStatusRecords()
    }, [fetchPropertyTypes, fetchStatusRecords])

    const loadPropertyTypes = () => {
        setIsLoadingCatalogs(true)
        void fetchPropertyTypes()
    }
    const loadStatusRecords = () => {
        setIsLoadingStatuses(true)
        void fetchStatusRecords()
    }

    useEffect(() => {
        // Solo una pestaña que existe EN ESTE MODO: `/new?tab=automations` abría un panel vacío.
        const tab = searchParams.get("tab")
        if (isPropertyTab(tab) && availableTabs.includes(tab)) {
            setActiveTab(tab)
        }
        // `availableTabs` depende solo del modo, fijo durante la vida del formulario.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, isCreate])

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
            thumbnailUrl: DEFAULT_PROPERTY_THUMBNAIL_URL,
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
    const thumbnailUrl = useWatch({ control: form.control, name: "thumbnailUrl" })
    const [brokenThumbnail, setBrokenThumbnail] = useState<string | null>(null)

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

    // Los errores se leen en el render a propósito (`formState` es un proxy):
    // así el contador por pestaña y el aviso bajan al corregir, sin otro envío.
    const { isDirty, errors } = form.formState
    const errorsByTab = countErrorsByTab(errors)
    const totalErrors = Object.values(errorsByTab).reduce((sum, n) => sum + n, 0)
    const orphanMessages = orphanErrorMessages(errors)

    /**
     * Activa la pestaña y, ya montada, enfoca el primer campo inválido de ella.
     * `source`: en `onInvalid` llegan los errores recién calculados; el `errors`
     * del render es el del render ANTERIOR (react-hook-form llama a `onInvalid`
     * antes de notificar al proxy), así que ahí no sirve.
     */
    function goToTabAndFocus(tab: FormTabId, source: Record<string, unknown> = errors) {
        setActiveTab(tab)
        const firstField = Object.keys(source).find((field) => (PROPERTY_FIELD_META[field]?.tab ?? "details") === tab)
        if (!firstField) return
        // El campo puede no estar montado todavía (otra pestaña): el foco lo da el
        // efecto de abajo cuando la pestaña ya pintó. Determinista, sin rAF.
        pendingFocusRef.current = { tab, field: firstField }
        setFocusTick((tick) => tick + 1)
    }

    const pendingFocusRef = useRef<{ tab: FormTabId; field: string } | null>(null)
    const [focusTick, setFocusTick] = useState(0)
    useEffect(() => {
        const pending = pendingFocusRef.current
        if (!pending || pending.tab !== activeTab) return
        pendingFocusRef.current = null
        try {
            form.setFocus(pending.field as Parameters<typeof form.setFocus>[0])
        } catch {
            // Un campo sin ref registrado (por ejemplo una lista): basta con la pestaña.
        }
        // `focusTick` es la señal; `form` es estable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusTick, activeTab])

    function onInvalid(invalid: Record<string, unknown>) {
        setShowErrorSummary(true)
        const firstField = Object.keys(invalid)[0]
        goToTabAndFocus(PROPERTY_FIELD_META[firstField]?.tab ?? "details", invalid)
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
        setShowErrorSummary(false)
        setIsLoading(true)
        try {
            let propertyUuid = initialData?.uuid

            // La clave `externalPmsIds` solo viaja si el PM editó la sección (ver `property-save.ts`).
            const submitValues = withExternalIdsGating(values, !!form.formState.dirtyFields.externalPmsIds)

            if (propertyUuid) {
                await propertiesService.update(propertyUuid, submitValues)
                invalidatePropertiesCaches()
                toast.success("Propiedad actualizada")
                router.push("/dashboard/properties")
            } else {
                // Propiedad y, con su uuid, cada alojamiento en borrador (secuencia fijada en `property-save.ts`).
                const created = await createPropertyWithUnits({
                    values,
                    submitValues,
                    createProperty: (v) => propertiesService.create(v),
                    onPropertyCreated: invalidatePropertiesCaches,
                    createListing: (payload) => listingsService.create(payload),
                    onListingError: (unitError) => console.error("[PropertyForm] Error creating listing:", unitError),
                })
                propertyUuid = created.propertyUuid
                const { failedUnits, pendingUnits } = created

                if (failedUnits.length > 0) {
                    toast.warning("Propiedad creada con alojamientos pendientes", {
                        description: `No se pudieron crear: ${failedUnits.join(", ")}. Agrégalos nuevamente desde la propiedad.`,
                    })
                } else {
                    toast.success(
                        pendingUnits > 0
                            ? `Propiedad y ${pendingUnits} alojamiento(s) creados`
                            : "Propiedad creada",
                    )
                }
                // A partial listing failure needs a visible recovery destination.
                router.push(propertyEditHref(propertyUuid, tabAfterCreate(failedUnits)))
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
            setIsDeleteDialogOpen(false)
            router.push("/dashboard/properties")
        } catch (error) {
            // El diálogo sigue abierto: se puede reintentar o cancelar (mismo patrón que fotos y alojamientos).
            notifyError(error, "Hubo un problema al intentar eliminar la propiedad.")
        } finally {
            setIsDeleting(false)
        }
    }

    // v3: al crear siempre; al editar solo con cambios pendientes del formulario raíz,
    // en cualquier pestaña (también en las que se guardan solas).
    const showActionBar = isCreate || isDirty
    const barStatus = isCreate ? <><RequiredMark /> Campos obligatorios</> : "Cambios sin guardar"
    const isDefaultThumbnail = thumbnailUrl === DEFAULT_PROPERTY_THUMBNAIL_URL

    return (
        <Form {...form}>
            {/* `pb-24`: el formulario reserva el alto de la barra fija para que nunca tape un campo. */}
            {/* `noValidate`: zod es el único validador. Sin esto, `type="email"`/`type="url"`
                disparan la burbuja nativa y `onInvalid` (aviso, pestaña, foco) nunca corre. */}
            <form noValidate onSubmit={(event) => void form.handleSubmit(onSubmit, onInvalid)(event)} className="space-y-6 pb-24">
                {showErrorSummary && totalErrors > 0 && (
                    <FeedbackBanner tone="danger" mode="blocking" title={totalErrors === 1 ? "Falta 1 campo" : `Faltan ${totalErrors} campos`}>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {(Object.keys(errorsByTab) as FormTabId[]).filter((tab) => errorsByTab[tab] > 0).map((tab) => (
                                <Button key={tab} type="button" variant="link" size="inline" onClick={() => goToTabAndFocus(tab)}>
                                    {TAB_LABELS[tab]} ({errorsByTab[tab]})
                                </Button>
                            ))}
                            <span>Los marcamos en cada pestaña.</span>
                        </span>
                        {/* Lo que no tiene campo donde mostrarse (listas, fotos) se dice aquí. */}
                        {orphanMessages.length > 0 && (
                            <ul className="mt-2 list-disc pl-5">
                                {orphanMessages.map(({ field, label, message }) => (
                                    <li key={field}>{label}: {message}</li>
                                ))}
                            </ul>
                        )}
                    </FeedbackBanner>
                )}

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PropertyTab)} className="space-y-6">
                    {/* Pestañas estándar: la pantalla solo pone la grilla. Con scroll horizontal en móvil. */}
                    <div className="overflow-x-auto">
                        <TabsList className="w-full min-w-max sm:min-w-0">
                            {availableTabs.map((tab) => {
                                const count = errorsByTab[tab as FormTabId] ?? 0
                                return (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab}
                                        aria-label={count > 0 ? `${TAB_LABELS[tab]}, ${count} ${count === 1 ? "error" : "errores"}` : undefined}
                                    >
                                        {TAB_LABELS[tab]}
                                        {count > 0 && <Badge tone="danger">{count}</Badge>}
                                    </TabsTrigger>
                                )
                            })}
                        </TabsList>
                    </div>

                    <TabsContent value="details" className="space-y-6">
                        <SectionCard title="Datos de la propiedad" description="Lo que verá el huésped y lo que HIT necesita para escribirle." headingLevel={2}>
                            <div className="space-y-4">
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
                                            <FormLabel>Nombre de la propiedad <RequiredMark /></FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Edificio Mirador" autoComplete="organization" {...field} />
                                            </FormControl>
                                            <FormDescription>El nombre comercial que verán los huéspedes.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Correo de contacto <RequiredMark /></FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder="contacto@tupropiedad.com" autoComplete="email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {/* Texto libre a propósito: se guarda tal como se escribe (extensiones
                                        incluidas). `PhoneInputField` normaliza y al vaciarse deja el prefijo. */}
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Teléfono <span className="font-normal text-ink-3">· opcional</span></FormLabel>
                                                <FormControl>
                                                    <Input type="tel" placeholder="+57 300 123 4567" autoComplete="tel" {...field} />
                                                </FormControl>
                                                <FormDescription>Con indicativo. Se guarda tal como lo escribes.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="propertyTypeId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tipo de propiedad <RequiredMark /></FormLabel>
                                                <Select
                                                    onValueChange={(v) => field.onChange(parseInt(v))}
                                                    value={field.value ? String(field.value) : ""}
                                                    disabled={isLoadingCatalogs || propertyTypesFailed}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger ref={field.ref} className="w-full">
                                                            <SelectValue placeholder={isLoadingCatalogs ? "Cargando…" : "Elige el tipo"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {propertyTypes.map(t => (
                                                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {propertyTypesFailed && (
                                                    <CatalogError
                                                        what="los tipos de propiedad"
                                                        consequence="Sin tipo no se puede guardar."
                                                        retrying={isLoadingCatalogs}
                                                        onRetry={loadPropertyTypes}
                                                    />
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="statusRecordId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estado <RequiredMark /></FormLabel>
                                                <Select
                                                    onValueChange={(v) => field.onChange(parseInt(v))}
                                                    value={String(field.value)}
                                                    disabled={isLoadingStatuses || statusesFailed}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger ref={field.ref} className="w-full">
                                                            <SelectValue placeholder={isLoadingStatuses ? "Cargando…" : "Elige el estado"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {statusRecords.map(s => (
                                                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {statusesFailed ? (
                                                    <CatalogError
                                                        what="los estados"
                                                        consequence="Se conserva el estado actual."
                                                        retrying={isLoadingStatuses}
                                                        onRetry={loadStatusRecords}
                                                    />
                                                ) : (
                                                    <FormDescription>Inactiva: sus reservas no se procesan y no se pueden crear nuevas.</FormDescription>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="communicationsLocale"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Idioma de comunicaciones</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || DEFAULT_COMMUNICATION_LOCALE}>
                                                    <FormControl>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Elige el idioma" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {COMMUNICATION_LOCALES.map((loc) => (
                                                            <SelectItem key={loc} value={loc}>{LOCALE_LABELS[loc]}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormDescription>Correos al huésped: link de check-in y recordatorios.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {/* La portada predeterminada VIAJA aunque no se toque: se muestra como
                                        dato real, con vista previa, nunca escondida como placeholder. */}
                                    <FormField
                                        control={form.control}
                                        name="thumbnailUrl"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Portada</FormLabel>
                                                <div className="flex items-center gap-3">
                                                    {field.value && brokenThumbnail !== field.value ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={field.value}
                                                            alt={isDefaultThumbnail ? "Portada predeterminada" : "Portada de la propiedad"}
                                                            className="h-10 w-14 shrink-0 rounded-md border border-rule object-cover"
                                                            // Una URL que no carga no deja el glifo de imagen rota: se oculta.
                                                            onError={() => setBrokenThumbnail(field.value ?? null)}
                                                        />
                                                    ) : null}
                                                    <FormControl>
                                                        <Input type="url" placeholder="https://…" {...field} value={field.value || ""} />
                                                    </FormControl>
                                                </div>
                                                <FormDescription>
                                                    {isDefaultThumbnail
                                                        ? "Portada predeterminada: se usa hasta que subas una foto en Fotos."
                                                        : "La primera foto de la galería. Puedes cambiarla en Fotos."}
                                                </FormDescription>
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
                                            <FormLabel>Descripción <span className="font-normal text-ink-3">· opcional</span></FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Qué hace especial a esta propiedad." className="min-h-25" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </SectionCard>

                        <SectionCard
                            title="Identificación externa"
                            description="Si esta propiedad ya existe en tu PMS o en un canal, su ID aquí asocia sus reservas externas."
                            headingLevel={2}
                        >
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
                        </SectionCard>

                        <PropertiesAmenities />

                        {/* Zona de peligro: solo al editar y lejos de la acción principal. */}
                        {!isCreate && (
                            <SectionCard
                                title="Eliminar propiedad"
                                description="Sus alojamientos y reservas se pierden. Esta acción no se puede deshacer."
                                headingLevel={2}
                                flush
                                actions={
                                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open && isDeleting) return; setIsDeleteDialogOpen(open) }}>
                                        <AlertDialogTrigger asChild>
                                            <Button type="button" variant="outline-destructive">
                                                <Icon icon={Trash2} />
                                                Eliminar propiedad
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Eliminar esta propiedad?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Se elimina {initialData?.name ? `«${initialData.name}»` : "la propiedad"} con todos
                                                    sus datos asociados. No se puede deshacer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction className={buttonVariants({ variant: "destructive" })} keepOpen pending={isDeleting} pendingLabel="Eliminando…" onClick={() => void onDelete()}>
                                                    Eliminar propiedad
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                }
                            >
                                <span className="sr-only">Zona de peligro</span>
                            </SectionCard>
                        )}
                    </TabsContent>

                    <TabsContent value="location" className="space-y-6">
                        <PropertiesLocation />
                    </TabsContent>

                    <TabsContent value="units" className="space-y-6">
                        <PropertiesUnits />
                    </TabsContent>

                    <TabsContent value="photos" className="space-y-6">
                        <PropertiesPhotos />
                    </TabsContent>

                    {!isCreate && (
                        <TabsContent value="automations" className="space-y-6">
                            <PropertiesAutomation onNavigateToDocuments={() => setActiveTab("documents")} />
                        </TabsContent>
                    )}

                    {!isCreate && (
                        <TabsContent value="documents" className="space-y-6">
                            <PropertiesDocuments />
                        </TabsContent>
                    )}
                </Tabs>

                {showActionBar && (
                    <FormActionBar status={barStatus}>
                        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/properties")} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" loading={isLoading} loadingLabel={isCreate ? "Creando…" : "Guardando…"} className="min-w-44">
                            {isCreate ? "Crear propiedad" : "Guardar cambios"}
                        </Button>
                    </FormActionBar>
                )}
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
        </Form>
    )
}
