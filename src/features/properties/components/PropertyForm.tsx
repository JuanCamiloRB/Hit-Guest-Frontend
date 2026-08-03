"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Trash2, LayoutDashboard, MapPin, Building, Camera, Sparkles, Info, AlertCircle, FileText } from "lucide-react"
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
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PropertiesLocation } from "./PropertiesLocation"
import { PropertiesUnits } from "./PropertiesUnits"
import { PropertiesPhotos } from "./PropertiesPhotos"
import { PropertiesAmenities } from "./PropertiesAmenities"
import { PropertiesAutomation } from "./PropertiesAutomation"
import { PropertiesDocuments } from "./documents"
import { propertyFormSchema, PropertyFormData, apiResponseToFormData } from "../types"
import { propertiesService } from "../services/properties-service"
import { listingsService } from "../services/listings-service"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { COMMUNICATION_LOCALES, LOCALE_LABELS, DEFAULT_COMMUNICATION_LOCALE } from "@/lib/locales"

interface PropertyFormProps {
    initialData?: any
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const [isLoading, setIsLoading] = useState(false)
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
    const [validationErrors, setValidationErrors] = useState<{ label: string; tab: string; message: string }[]>([])
    const [activeTab, setActiveTab] = useState("details")
    const [statusRecords, setStatusRecords] = useState<CatalogOption[]>([])
    
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const tab = searchParams.get("tab")
        if (tab) {
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
                // Fallback for status records since it's a critical dropdown
                setStatusRecords([
                    { id: "1", name: "Activo" },
                    { id: "2", name: "Inactivo" }
                ])
            }
        }
        fetchCatalogs()
    }, [])


    const form = useForm<PropertyFormData>({
        resolver: zodResolver(propertyFormSchema) as any,
        defaultValues: (initialData ? { ...initialData, uuid: initialData.uuid } : {
            name: "",
            external_id: "",
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
            propertyTypeId: 102,
            communicationsLocale: DEFAULT_COMMUNICATION_LOCALE,
            amenities: [],
            wifiNetwork: "",
            wifiPassword: "",
            picturesUrl: [],
            thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
            units: [],
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

    // Field → friendly label + tab where the user can fix it
    const FIELD_META: Record<string, { label: string; tab: string }> = {
        name:           { label: "Nombre de la propiedad", tab: "Detalles" },
        email:          { label: "Email de contacto",      tab: "Detalles" },
        phone:          { label: "Teléfono",               tab: "Detalles" },
        propertyTypeId: { label: "Tipo de propiedad",      tab: "Detalles" },
        statusRecordId: { label: "Estado",                 tab: "Detalles" },
        external_id:    { label: "Nombre interno (ID)",    tab: "Detalles" },
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

    function onInvalid(errors: Record<string, any>) {
        const items = Object.entries(errors).map(([field, err]) => {
            const meta = FIELD_META[field] ?? { label: field, tab: "Detalles" }
            return {
                label: meta.label,
                tab: meta.tab,
                message: (err as any)?.message || "Campo obligatorio o inválido",
            }
        })
        setValidationErrors(items)
        setIsValidationErrorOpen(true)
    }

    async function onSubmit(values: PropertyFormData) {
        setIsLoading(true)
        try {
            console.log("[PropertyForm] Starting save process...", values)
            let propertyUuid = initialData?.uuid

            if (propertyUuid) {
                await propertiesService.update(propertyUuid, values)
                toast.success("Propiedad actualizada")
                router.push("/dashboard/properties")
            } else {
                const response = await propertiesService.create(values)
                propertyUuid = response.uuid || (response as any).data?.uuid
                toast.success("Propiedad creada")
 
                // Restore manual creation: units MUST be created via separate /listings endpoint
                const pendingUnits = values.units || []
                if (pendingUnits.length > 0 && propertyUuid) {
                    let created = 0
                    for (const u of pendingUnits as any[]) {
                        try {
                            const { extra = {} as any, ...rest } = u
                            const {
                                inheritWifi, inheritSchedule, inheritPolicies,
                                wifiDetails, checkIn, checkOut, cancellationPolicy,
                                ...cleanExtra
                            } = extra as any
 
                            if (!inheritWifi)     cleanExtra.wifiDetails = wifiDetails
                            if (!inheritSchedule) { cleanExtra.checkIn = checkIn; cleanExtra.checkOut = checkOut }
                            if (!inheritPolicies) cleanExtra.cancellationPolicy = cancellationPolicy
 
                            const unitPrice = Number(u.price || rest.price) || 0
                            cleanExtra.startPrice = unitPrice  // Backend mapea extra.startPrice
 
                            await listingsService.create({
                                propertyUuid,
                                name:          u.name,
                                internalName:  u.internalName,
                                roomTypeId:    Number(u.roomTypeId) || 1,
                                description:   u.description,
                                thumbnailUrl:  u.thumbnailUrl,
                                contactName:   u.contactName,
                                contactEmail:  u.contactEmail,
                                contactPhone:  u.contactPhone,
                                statusRecordId: u.isActive !== false ? 6 : 7,
                                extra:         cleanExtra,
                            })
                            created++
                        } catch (uErr) {
                            console.error("[PropertyForm] Error creating listing:", uErr)
                        }
                    }
                    if (created > 0) toast.info(`${created} unidad(es) añadida(s).`)
                }
 
                // Redirect to edit page on the automations tab so the user can
                // immediately configure the automations created with the property.
                router.push(`/dashboard/properties/${propertyUuid}?tab=automations`)
            }
        } catch (error) {
            console.error("[PropertyForm] Save error:", error)
            notifyError(error, "Hubo un problema al intentar guardar los cambios.")
            setIsLoading(false)
        }
    }

    async function onDelete() {
        if (!initialData?.uuid) return
        setIsDeleting(true)
        try {
            await propertiesService.delete(initialData.uuid)
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
                    <TabsList className={cn(
                        "grid w-full h-auto bg-slate-100/50 p-1 border border-slate-200/60 rounded-xl shadow-sm",
                        initialData
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
                            : "grid-cols-2 md:grid-cols-2 lg:grid-cols-4"
                    )}>
                        <TabsTrigger
                            value="details"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Info className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "details" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Detalles</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="units"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Building className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "units" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Alojamientos</span>
                        </TabsTrigger>
                        {initialData && (
                            <TabsTrigger
                                value="automations"
                                className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                            >
                                <Sparkles className={cn(
                                    "mr-2 h-4 w-4 transition-colors",
                                    activeTab === "automations" ? "text-white" : "text-[var(--color-brand-purple)]"
                                )} />
                                <span className="font-bold">Automatización</span>
                            </TabsTrigger>
                        )}
                        {initialData && (
                            <TabsTrigger
                                value="documents"
                                className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                            >
                                <FileText className={cn(
                                    "mr-2 h-4 w-4 transition-colors",
                                    activeTab === "documents" ? "text-white" : "text-[var(--color-brand-purple)]"
                                )} />
                                <span className="font-bold">Documentos</span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger
                            value="location"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <MapPin className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "location" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Ubicación</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="photos"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Camera className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "photos" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Fotos</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader className="border-b bg-slate-50/50">
                                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                                    <LayoutDashboard className="h-5 w-5 text-[var(--color-brand-purple)]" />
                                    Detalles de la Propiedad
                                </CardTitle>
                                <CardDescription>
                                    Información básica y administrativa de la propiedad.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre de la Propiedad <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Hotel Oasis" {...field} />
                                                </FormControl>
                                                <FormDescription>El nombre comercial que verán los huéspedes.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="external_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre Interno (ID)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="HOTEL_OASIS_001" {...field} />
                                                </FormControl>
                                                <FormDescription>Identificador único para uso administrativo.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email de Contacto <span className="text-destructive">*</span></FormLabel>
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
                                                <FormLabel>Tipo de Propiedad <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar tipo de propiedad" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {propertyTypes.length > 0 ? (
                                                            propertyTypes.map(t => (
                                                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                            ))
                                                        ) : (
                                                            <>
                                                                <SelectItem value="102">Apartamento</SelectItem>
                                                                <SelectItem value="100">Casa</SelectItem>
                                                                <SelectItem value="101">Hotel</SelectItem>
                                                            </>
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
                                                <FormLabel>Estado <span className="text-destructive">*</span></FormLabel>
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
                                                            <>
                                                                <SelectItem value="1">Activo</SelectItem>
                                                                <SelectItem value="2">Inactivo</SelectItem>
                                                            </>
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
                                                <Textarea placeholder="Una hermosa propiedad..." className="min-h-[100px]" {...field} />
                                            </FormControl>
                                            <FormMessage />
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
                                <Button type="button" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                                    <Trash2 className="mr-2 h-4 w-4" />
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
                                    <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Confirmar Eliminación
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    ) : <div />}

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold h-11 px-8 rounded-lg shadow-sm transition-all"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Actualizar Propiedad" : "Crear Propiedad"}
                    </Button>
                </div>
            </form>

            <Dialog open={isValidationErrorOpen} onOpenChange={setIsValidationErrorOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <div className="flex items-center gap-3 text-destructive mb-2">
                            <AlertCircle className="h-6 w-6" />
                            <DialogTitle className="text-xl">Información Faltante</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600">
                            Completa los siguientes campos para poder guardar la propiedad:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2 max-h-64 overflow-y-auto">
                        <ul className="space-y-2.5">
                            {validationErrors.map((err, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                                            {err.label}
                                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                                {err.tab}
                                            </span>
                                        </p>
                                        <p className="text-xs text-slate-500">{err.message}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <DialogFooter>
                        <Button 
                            className="w-full bg-primary hover:bg-primary"
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
