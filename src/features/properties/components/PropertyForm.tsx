"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
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
})

interface PropertyFormProps {
    initialData?: any
}

export function PropertyForm({ initialData }: PropertyFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const router = useRouter()

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
            }
        } : {
            name: "",
            internalName: "",
            description: "",
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
            roomTypes: [],
            units: [],
        },
    })

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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Tabs defaultValue="details" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="details">Detalles</TabsTrigger>
                        <TabsTrigger value="location">Ubicación</TabsTrigger>
                        <TabsTrigger value="units">Unidades</TabsTrigger>
                        <TabsTrigger value="photos">Fotos</TabsTrigger>
                        <TabsTrigger value="automation">Automatización</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Detalles de la Propiedad</CardTitle>
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
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estado</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                                <FormLabel>Precio Inicial</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Reglas de Automatización</CardTitle>
                                <CardDescription>Configura mensajes y tareas automáticas para esta propiedad.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center h-24 bg-muted/20 border border-dashed rounded text-muted-foreground">
                                    Espacio para la Configuración de Automatización
                                </div>
                            </CardContent>
                        </Card>
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

                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Actualizar Propiedad" : "Crear Propiedad"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
