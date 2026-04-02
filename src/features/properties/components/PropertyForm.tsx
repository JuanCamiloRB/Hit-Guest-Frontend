"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Trash2, LayoutDashboard, MapPin, Building, Camera, Sparkles, Info, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useState } from "react"
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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PropertiesLocation } from "./PropertiesLocation"
import { PropertiesUnits } from "./PropertiesUnits"
import { PropertiesPhotos } from "./PropertiesPhotos"
import { PropertiesAmenities } from "./PropertiesAmenities"
import { PropertiesAutomation } from "./PropertiesAutomation"
import { Switch } from "@/components/ui/switch"
<<<<<<< Updated upstream
import { deleteProperty, updateProperty } from "../services/properties"

const propertySchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    internalName: z.string().min(2, "El nombre interno es obligatorio"),
    description: z.string().optional(),
    type: z.string().min(1, "El tipo es obligatorio"),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    thumbnailUrl: z.string().min(1, "La URL de la imagen es obligatoria"),
    address: z.object({
        line1: z.string().min(5, "La dirección es obligatoria"),
        line2: z.string().optional(),
        postal_code: z.string().optional(),
        city: z.string().min(2, "La ciudad es obligatoria"),
        state: z.string().optional(),
        country: z.string().min(2, "El país es obligatorio"),
    }),
    geoLocation: z.object({
        latitude: z.number(),
        longitude: z.number(),
    }),
    startPrice: z.number().min(0, "El precio debe ser mayor o igual a 0"),
    currency: z.string().min(3, "Código de moneda obligatorio (ej: COP)"),
    timeZone: z.string().min(1, "La zona horaria es obligatoria"),
    roomTypes: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        name: z.string()
    })).optional(),
    units: z.array(z.any()).optional(),
    automationSettings: z.object({
        welcome_message: z.boolean(),
        checkin_instructions: z.boolean(),
        digital_key: z.boolean(),
        online_checkin: z.boolean(),
        cleaning_task: z.boolean(),
    }),
})
=======
import { propertyFormSchema, PropertyFormData, apiResponseToFormData } from "../types"
import { propertiesService } from "../services/properties-service"
import { listingsService } from "../services/listings-service"
import { catalogsService as catalogService, CatalogOption } from "@/services/catalogs-service"
import { groupTimezonesByRegion } from "@/lib/catalog-utils"
import { GroupedCatalogOption } from "@/types/catalogs"
import { AlertCircle } from "lucide-react"
>>>>>>> Stashed changes

interface PropertyFormProps {
    initialData?: any
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("details")
    const router = useRouter()

<<<<<<< Updated upstream
    const form = useForm<z.infer<typeof propertySchema>>({
        resolver: zodResolver(propertySchema),
        defaultValues: initialData ? {
            ...initialData,
            status: initialData.status as any,
            address: initialData.address || {
                line1: "",
                city: "",
                country: "Colombia"
            },
            geoLocation: initialData.geoLocation || {
                latitude: 10.3910,
                longitude: -75.4794
            },
            automationSettings: initialData.automationSettings || {
                welcome_message: true,
                checkin_instructions: true,
                digital_key: false,
                online_checkin: true,
                cleaning_task: true,
            }
        } : {
=======
    useEffect(() => {
        const tab = searchParams.get("tab")
        if (tab) {
            setActiveTab(tab)
        }
    }, [searchParams])

    useEffect(() => {
        const fetchCatalogs = async () => {
            const [timezones, statuses] = await Promise.all([
                catalogService.getTimezones(),
                catalogService.getStatusRecords()
            ])
            setGroupedTimezones(groupTimezonesByRegion(timezones))
            if (statuses.length > 0) setStatusRecords(statuses)
        }
        fetchCatalogs()
    }, [])

    const form = useForm<PropertyFormData>({
        resolver: zodResolver(propertyFormSchema) as any,
        defaultValues: initialData || {
>>>>>>> Stashed changes
            name: "",
            internalName: "",
            description: "",
<<<<<<< Updated upstream
            type: "HOTEL",
            status: "ACTIVE",
            thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
            address: {
                line1: "",
                line2: "",
                postal_code: "",
                city: "",
                state: "",
                country: "Colombia",
            },
            geoLocation: {
                latitude: 10.3910,
                longitude: -75.4794,
            },
            startPrice: 0,
            currency: "COP",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
=======
            email: "",
            phone: "",
            address: "",
            addressDetail: "",
            city: "",
            state: "",
            countryId: 48,
            latitude: 0,
            longitude: 0,
            timezone: "America/Bogota",
            statusRecordId: 6,
            type: "HOTEL",
            startPrice: "",
            currency: "COP",
            amenities: [],
            wifiNetwork: "",
            wifiPassword: "",
            picturesUrl: [],
            thumbnailUrl: "",
            units: [],
            policies: [],
>>>>>>> Stashed changes
            roomTypes: [],
            units: [],
            automationSettings: {
                welcome_message: true,
                checkin_instructions: true,
                digital_key: false,
                online_checkin: true,
                cleaning_task: true,
            },
        },
    })

<<<<<<< Updated upstream
    async function onSubmit(values: z.infer<typeof propertySchema>) {
        setIsLoading(true)
        try {
            if (initialData?.id) {
                await updateProperty(initialData.id, values)
                toast.success("Propiedad actualizada", {
                    description: `${values.name} ha sido actualizada exitosamente.`,
                })
            } else {
                // In a real app we'd call a createProperty service here
                await new Promise((resolve) => setTimeout(resolve, 1000))
                toast.success("Propiedad creada", {
                    description: `${values.name} ha sido creada exitosamente.`,
                })
=======
    // Reset form when initialData arrives from async fetch
    useEffect(() => {
        if (initialData) {
            form.reset(initialData)
        }
    }, [initialData, form])


    async function onSubmit(values: PropertyFormData) {
        setIsLoading(true)
        try {
            console.log("[PropertyForm] Starting save process...")
            let propertyUuid = initialData?.uuid

            // 1. Save main property data
            if (propertyUuid) {
                await propertiesService.update(propertyUuid, values)
                toast.success("Propiedad actualizada")
            } else {
                const response = await propertiesService.create(values)
                propertyUuid = response.uuid
                toast.success("Propiedad creada")
>>>>>>> Stashed changes
            }

            toast.info("Cambios sincronizados correctamente.")
            router.push("/dashboard/properties")
        } catch (error) {
            console.error("[PropertyForm] Save error:", error)
            toast.error("Error al guardar", {
                description: "Hubo un problema al intentar guardar los cambios o las unidades.",
            })
            setIsLoading(false)
        }
    }

    async function onDelete() {
        if (!initialData?.id) return
        setIsDeleting(true)
        try {
            await deleteProperty(initialData.id)
            toast.success("Propiedad eliminada", {
                description: "La propiedad ha sido eliminada exitosamente.",
            })
            router.push("/dashboard/properties")
        } catch (error) {
            toast.error("Error al eliminar", {
                description: "Hubo un problema al intentar eliminar la propiedad.",
            })
        } finally {
            setIsDeleting(false)
            setIsDeleteDialogOpen(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Tabs defaultValue="details" onValueChange={(v) => setActiveTab(v)} className="space-y-6">
                    <TabsList className={cn(
                        "grid w-full h-auto bg-slate-100/50 p-1 border border-slate-200/60 rounded-xl shadow-sm",
                        "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
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
                            value="units"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Building className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "units" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Unidades</span>
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
                        <TabsTrigger
                            value="automation"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Sparkles className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "automation" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Automatización</span>
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
                            <CardContent className="space-y-4">
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
                                        name="internalName"
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
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tipo de Propiedad <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Hotel, Apartamento, etc." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
<<<<<<< Updated upstream
                                                <FormLabel>Estado</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
=======
                                                <FormLabel>Estado <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={String(field.value)}>
>>>>>>> Stashed changes
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar estado" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="ACTIVE">Activo</SelectItem>
                                                        <SelectItem value="INACTIVE">Inactivo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="thumbnailUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL de Miniatura (Thumbnail)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                    <FormField
                                        control={form.control}
                                        name="startPrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Precio Inicial <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
<<<<<<< Updated upstream
                                                    <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
=======
                                                    <Input 
                                                        type="number" 
                                                        placeholder="0.00"
                                                        {...field} 
                                                        value={field.value ?? ""}
                                                        onChange={(e) => field.onChange(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (["e", "E", "+", "-"].includes(e.key)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    />
>>>>>>> Stashed changes
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Moneda</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="COP" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="timeZone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Zona Horaria</FormLabel>
                                            <FormControl>
                                                <Input placeholder="America/Bogota" {...field} />
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

                    <TabsContent value="automation" className="space-y-4">
                        <PropertiesAutomation />
                    </TabsContent>
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
                                    <DialogHeader>
                                        <DialogDescription>
                                            Esta acción no se puede deshacer. Esto eliminará permanentemente la propiedad
                                            y todos sus datos asociados.
                                        </DialogDescription>
                                    </DialogHeader>
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
<<<<<<< Updated upstream
=======

            <Dialog open={isValidationErrorOpen} onOpenChange={setIsValidationErrorOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <div className="flex items-center gap-3 text-destructive mb-2">
                            <AlertCircle className="h-6 w-6" />
                            <DialogTitle className="text-xl">Información Faltante</DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-600">
                            No se pudo crear la propiedad porque faltan algunos campos obligatorios. 
                            Por favor, revisa todas las pestañas (Detalles, Ubicación, Alojamientos, etc.) y completa la información marcada en rojo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-4">
                        <h4 className="font-bold text-sm mb-2 text-slate-800">Campos comunes obligatorios:</h4>
                        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                            <li>Nombre de la propiedad</li>
                            <li>Correo electrónico</li>
                            <li>Dirección, Ciudad y Estado</li>
                            <li>Tipo de propiedad</li>
                            <li>Precio Inicial</li>
                        </ul>
                    </div>
                    <DialogFooter>
                        <Button 
                            className="w-full bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => setIsValidationErrorOpen(false)}
                        >
                            Entendido, voy a revisar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
>>>>>>> Stashed changes
        </Form>
    )
}
