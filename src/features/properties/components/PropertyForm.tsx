"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Trash2, LayoutDashboard, MapPin, Building, Camera, Sparkles, Info, Upload, X, Shield } from "lucide-react"
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
import { PropertiesPolicies } from "./PropertiesPolicies"
import { Switch } from "@/components/ui/switch"
import { deleteProperty, updateProperty, createProperty } from "../services/properties"
import { AlertCircle } from "lucide-react"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { groupTimezonesByRegion } from "@/lib/catalog-utils"
import { GroupedCatalogOption } from "@/types/catalogs"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { SelectGroup, SelectLabel } from "@/components/ui/select"

const propertySchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    external_id: z.string().optional(),
    description: z.string().optional(),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    address: z.string().min(5, "La dirección es obligatoria"),
    address_detail: z.string().optional(),
    city: z.string().min(2, "La ciudad es obligatoria"),
    state: z.string().optional(),
    country_id: z.number(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    timezone: z.string().min(1, "La zona horaria es obligatoria"),
    status_record_id: z.number(),
    
    // Fields that will be stored in 'extra'
    type: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    startPrice: z.number().min(0).optional(),
    currency: z.string().optional(),
    roomTypes: z.array(z.any()).optional(),
    units: z.array(z.any()).optional(),
    policies: z.array(z.any()).optional(),
    amenities: z.array(z.union([z.string(), z.number()])).optional(),
    images: z.array(z.string()).optional(),
    automationSettings: z.object({
        welcome_message: z.boolean(),
        checkin_instructions: z.boolean(),
        digital_key: z.boolean(),
        online_checkin: z.boolean(),
        cleaning_task: z.boolean(),
    }).optional(),
})

interface PropertyFormProps {
    initialData?: any
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("details")
    const [isValidationErrorOpen, setIsValidationErrorOpen] = useState(false)
    const [groupedTimezones, setGroupedTimezones] = useState<GroupedCatalogOption[]>([])
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
            const [timezones, statuses] = await Promise.all([
                catalogService.getTimezones(),
                catalogService.getStatusRecords()
            ])
            setGroupedTimezones(groupTimezonesByRegion(timezones))
            if (statuses.length > 0) setStatusRecords(statuses)
        }
        fetchCatalogs()
    }, [])

    const form = useForm<z.infer<typeof propertySchema>>({
        resolver: zodResolver(propertySchema),
        defaultValues: initialData ? {
            ...initialData,
            name: initialData.name || "",
            external_id: initialData.external_id || "",
            description: initialData.description || "",
            email: initialData.email || "",
            phone: initialData.phone || "",
            address: initialData.address || "",
            address_detail: initialData.address_detail || "",
            city: initialData.city || "",
            state: initialData.state || "",
            country_id: initialData.country_id || 1,
            timezone: initialData.timezone || "",
            status_record_id: initialData.status_record_id || 1,

            // Parse latitude/longitude from geo_location string "lat,lng"
            latitude: initialData.geo_location ? parseFloat(initialData.geo_location.split(',')[0]) : 10.3910,
            longitude: initialData.geo_location ? parseFloat(initialData.geo_location.split(',')[1]) : -75.4794,
            
            // Map from extra
            type: initialData.extra?.type || "HOTEL",
            thumbnailUrl: initialData.extra?.thumbnailUrl || "",
            startPrice: initialData.extra?.startPrice || 0,
            currency: initialData.extra?.currency || "COP",
            roomTypes: initialData.extra?.roomTypes || [],
            units: initialData.units || [],
            policies: initialData.extra?.policies || [],
            amenities: initialData.extra?.amenities || [],
            images: initialData.extra?.images || [],
            automationSettings: initialData.extra?.automationSettings || {
                welcome_message: true,
                checkin_instructions: true,
                digital_key: false,
                online_checkin: true,
                cleaning_task: true,
            }
        } : {
            name: "",
            external_id: "",
            description: "",
            email: "",
            phone: "",
            address: "",
            address_detail: "",
            city: "",
            state: "",
            country_id: 1,
            geo_location: "10.3910,-75.4794",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            status_record_id: 1,
            type: "HOTEL",
            thumbnailUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&auto=format&fit=crop&q=60",
            startPrice: 0,
            currency: "COP",
            roomTypes: [],
            units: [],
            policies: [],
            amenities: [],
            images: [],
            automationSettings: {
                welcome_message: true,
                checkin_instructions: true,
                digital_key: false,
                online_checkin: true,
                cleaning_task: true,
            },
        },
    })

    async function onSubmit(values: z.infer<typeof propertySchema>) {
        setIsLoading(true)
        try {
            // Map flat form values to Property structure with extra JSON
            const propertyData: any = {
                name: values.name,
                external_id: values.external_id,
                description: values.description,
                email: values.email,
                phone: values.phone,
                address: values.address,
                address_detail: values.address_detail,
                city: values.city,
                state: values.state,
                country_id: values.country_id,
                geo_location: `${values.latitude},${values.longitude}`,
                timezone: values.timezone,
                status_record_id: values.status_record_id,
                extra: {
                    type: values.type,
                    thumbnailUrl: values.thumbnailUrl,
                    startPrice: values.startPrice,
                    currency: values.currency,
                    roomTypes: values.roomTypes,
                    policies: values.policies,
                    amenities: values.amenities,
                    images: values.images,
                    automationSettings: values.automationSettings,
                },
                units: values.units // In a real app, this would be handled separately
            }

            if (initialData?.id) {
                await updateProperty(initialData.id, propertyData)
                toast.success("Propiedad actualizada", {
                    description: `${values.name} ha sido actualizada exitosamente.`,
                })
            } else {
                await createProperty(propertyData)
                toast.success("Propiedad creada", {
                    description: `${values.name} ha sido creada exitosamente.`,
                })
            }
            router.push("/dashboard/properties")
        } catch (error) {
            toast.error("Error al guardar", {
                description: "Hubo un problema al intentar guardar los cambios.",
            })
        } finally {
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

    const onInvalid = (errors: any) => {
        console.error("Validation errors:", errors)
        setIsValidationErrorOpen(true)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                <Tabs defaultValue="details" onValueChange={(v) => setActiveTab(v)} className="space-y-6">
                    <TabsList className={cn(
                        "grid w-full h-auto bg-slate-100/50 p-1 border border-slate-200/60 rounded-xl shadow-sm",
                        "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
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
                            value="policies"
                            className="data-[state=active]:bg-[var(--color-brand-purple)] data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 rounded-lg py-2.5 h-full"
                        >
                            <Shield className={cn(
                                "mr-2 h-4 w-4 transition-colors",
                                activeTab === "policies" ? "text-white" : "text-[var(--color-brand-purple)]"
                            )} />
                            <span className="font-bold">Políticas</span>
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
                                                <FormLabel>Nombre de la Propiedad</FormLabel>
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
                                                <FormLabel>Email de Contacto</FormLabel>
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
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tipo de Propiedad</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Hotel, Apartamento, etc." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="status_record_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estado</FormLabel>
                                                <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={String(field.value)}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar estado" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {statusRecords.length > 0 ? (
                                                            statusRecords.map(status => (
                                                                <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
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
                                                <FormLabel>Precio Inicial</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        {...field} 
                                                        onChange={e => field.onChange(parseFloat(e.target.value))}
                                                        onKeyDown={(e) => {
                                                            if (["e", "E", "+", "-"].includes(e.key)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                    />
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
                                    name="timezone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Zona Horaria</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar zona horaria" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="max-h-[300px]">
                                                    {groupedTimezones.map((group) => (
                                                        <SelectGroup key={group.group}>
                                                            <SelectLabel className="font-bold text-[var(--color-brand-purple)] bg-slate-50/50">
                                                                {group.group}
                                                            </SelectLabel>
                                                            {group.options.map((option, idx) => (
                                                                <SelectItem key={`${group.group}-${option.id}-${idx}`} value={option.id}>
                                                                    {option.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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

                    <TabsContent value="policies" className="space-y-4">
                        <PropertiesPolicies />
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
                            <li>Ciudad y Estado</li>
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
        </Form>
    )
}
