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
import { Plus, Trash2, Edit2, Building, BedDouble, Bath, Clock, Settings2, Shield } from "lucide-react"
import { useFormContext, useFieldArray } from "react-hook-form"
import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { catalogsService as catalogService, CatalogOption } from "@/services/catalogs-service"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const defaultUnit = {
    name: "",
    internal_name: "",
    room_type_id: 1,
    thumbnail_url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=60",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    status_record_id: 1,
    isActive: true, // UI state
    extra: {
        pictures_url: [],
        bed_room: { type: "SINGLE", count: 1, bedsCount: 1 },
        bath_room: { type: "PRIVATE", count: 1 },
        rooms: 1,
        max_occupancy: 2,
        min_nights: 1,
        max_nights: 30,
        channels: [],
        check_in: "15:00",
        check_out: "11:00",
        wifi_details: { ssid: "", pwd: "" },
        amenities: [],
        cancellation_policy: "STANDARD",
        inheritWifi: true,
    },
    // UI specific/temporary fields
    price: "",
    customFields: [] as { name: string; value: string; id: string }[]
}

export function PropertiesUnits() {
    const { control, watch } = useFormContext()
    const propWifiNetwork = watch("wifiNetwork")
    const propWifiPassword = watch("wifiPassword")

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "units",
    })

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [unitForm, setUnitForm] = useState({ ...defaultUnit })
    const [roomTypes, setRoomTypes] = useState<CatalogOption[]>([])
    const [bedTypes, setBedTypes] = useState<CatalogOption[]>([])
    const [bathTypes, setBathTypes] = useState<CatalogOption[]>([])
    const [cancellationPolicies, setCancellationPolicies] = useState<CatalogOption[]>([])

    useEffect(() => {
        Promise.all([
            catalogService.getRoomTypes(),
            catalogService.getBedTypes(),
            catalogService.getBathTypes(),
            catalogService.getCancellationPolicies(),
        ]).then(([rooms, beds, baths, policies]) => {
            if (rooms.length > 0) setRoomTypes(rooms)
            setBedTypes(beds)
            setBathTypes(baths)
            setCancellationPolicies(policies)
        })
    }, [])

    const handleOpenAddDialog = () => {
        setUnitForm({ ...defaultUnit })
        setEditingIndex(null)
        setIsDialogOpen(true)
    }

    const handleOpenEditDialog = (index: number) => {
        setUnitForm(fields[index] as any)
        setEditingIndex(index)
        setIsDialogOpen(true)
    }

    const handleSaveUnit = () => {
        if (!unitForm.name || unitForm.name.trim().length < 2) {
            toast.error("El nombre de la unidad es requerido", {
                description: "Por favor asigna un nombre de al menos 2 caracteres.",
            })
            return
        }

        if (editingIndex !== null) {
            update(editingIndex, unitForm)
        } else {
            append(unitForm)
        }
        setIsDialogOpen(false)
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Building className="h-5 w-5 text-[var(--color-brand-purple)]" />
                            Unidades (Alojamientos)
                        </CardTitle>
                        <CardDescription>
                            Gestiona las unidades disponibles para reservar en esta propiedad.
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

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle>{editingIndex !== null ? "Editar Unidad" : "Añadir Unidad"}</DialogTitle>
                                <DialogDescription>
                                    Configura los detalles del alojamiento.
                                </DialogDescription>
                            </DialogHeader>
                            
                            <ScrollArea className="flex-1 px-6 py-2">
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

                                    <Tabs defaultValue="general" className="w-full">
                                        <TabsList className="grid grid-cols-4 mb-4">
                                            <TabsTrigger value="general" className="text-[10px] uppercase font-bold">General</TabsTrigger>
                                            <TabsTrigger value="amenities" className="text-[10px] uppercase font-bold">Dotación</TabsTrigger>
                                            <TabsTrigger value="rooms" className="text-[10px] uppercase font-bold">Muebles</TabsTrigger>
                                            <TabsTrigger value="policies" className="text-[10px] uppercase font-bold">Políticas</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="general" className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="name">Nombre de Unidad <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        id="name"
                                                        placeholder="Suite Junior"
                                                        value={unitForm.name}
                                                        onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="internal_name">Nombre Interno / Número</Label>
                                                    <Input
                                                        id="internal_name"
                                                        placeholder="Ej. SJ-101"
                                                        value={unitForm.internal_name}
                                                        onChange={(e) => setUnitForm({ ...unitForm, internal_name: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="room_type_id">Categoría del Alojamiento</Label>
                                                    <Select
                                                        value={String(unitForm.room_type_id)}
                                                        onValueChange={(value) => setUnitForm({ ...unitForm, room_type_id: parseInt(value) })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar tipo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {roomTypes.length > 0 ? (
                                                                roomTypes.map(rt => (
                                                                    <SelectItem key={rt.id} value={String(rt.id)}>{rt.name}</SelectItem>
                                                                ))
                                                            ) : (
                                                                <>
                                                                    <SelectItem value="1">Alojamiento Entero</SelectItem>
                                                                    <SelectItem value="2">Habitación Privada</SelectItem>
                                                                    <SelectItem value="3">Habitación Compartida</SelectItem>
                                                                </>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="maxOccupancy">Capacidad Máxima</Label>
                                                    <Input
                                                        id="maxOccupancy"
                                                        type="number"
                                                        value={unitForm.extra.max_occupancy}
                                                        onChange={(e) => setUnitForm({ 
                                                            ...unitForm, 
                                                            extra: { ...unitForm.extra, max_occupancy: parseInt(e.target.value) || 0 } 
                                                        })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="price">Precio Inicial por Noche (COP)</Label>
                                                    <Input
                                                        id="price"
                                                        type="number"
                                                        placeholder="250000"
                                                        value={unitForm.price}
                                                        onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contact_name">Nombre de Contacto</Label>
                                                    <Input
                                                        id="contact_name"
                                                        placeholder="Nombre del encargado"
                                                        value={unitForm.contact_name}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contact_name: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contact_email">Correo Electrónico <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        id="contact_email"
                                                        type="email"
                                                        placeholder="ejemplo@kunas.co"
                                                        value={unitForm.contact_email}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contact_email: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contact_phone">Teléfono de Contacto</Label>
                                                    <Input
                                                        id="contact_phone"
                                                        placeholder="+57..."
                                                        value={unitForm.contact_phone}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contact_phone: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-4 border-t">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-[10px] font-bold uppercase text-slate-400">Campos Personalizados</h4>
                                                    <Button 
                                                        type="button" 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => setUnitForm({
                                                            ...unitForm,
                                                            customFields: [...(unitForm.customFields || []), { id: Math.random().toString(), name: "", value: "" }]
                                                        })}
                                                        className="h-6 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" /> Añadir Campo
                                                    </Button>
                                                </div>
                                                
                                                {(unitForm.customFields || []).length > 0 && (
                                                    <div className="space-y-2">
                                                        {unitForm.customFields.map((cf, idx) => (
                                                            <div key={cf.id} className="flex gap-2 items-center">
                                                                <Input 
                                                                    placeholder="Nombre" 
                                                                    value={cf.name} 
                                                                    onChange={(e) => {
                                                                        const newFields = [...unitForm.customFields]
                                                                        newFields[idx].name = e.target.value
                                                                        setUnitForm({ ...unitForm, customFields: newFields })
                                                                    }}
                                                                    className="h-8 text-xs flex-1"
                                                                />
                                                                <Input 
                                                                    placeholder="Valor" 
                                                                    value={cf.value || ""} 
                                                                    onChange={(e) => {
                                                                        const newFields = [...unitForm.customFields]
                                                                        newFields[idx].value = e.target.value
                                                                        setUnitForm({ ...unitForm, customFields: newFields })
                                                                    }}
                                                                    className="h-8 text-xs flex-1"
                                                                />
                                                                <Button 
                                                                    type="button" 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    onClick={() => {
                                                                        const newFields = unitForm.customFields.filter((_, i) => i !== idx)
                                                                        setUnitForm({ ...unitForm, customFields: newFields })
                                                                    }}
                                                                    className="h-8 w-8 text-slate-300 hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="amenities" className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-[var(--color-brand-purple)]" />
                                                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Horarios</h4>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border">
                                                    <div className="space-y-3">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Check-in</p>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px]">Hora</Label>
                                                                <Input 
                                                                    type="time" 
                                                                    value={unitForm.extra.check_in}
                                                                    onChange={(e) => setUnitForm({ 
                                                                        ...unitForm, 
                                                                        extra: { ...unitForm.extra, check_in: e.target.value }
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
                                                                    value={unitForm.extra.check_out}
                                                                    onChange={(e) => setUnitForm({ 
                                                                        ...unitForm, 
                                                                        extra: { ...unitForm.extra, check_out: e.target.value }
                                                                    })}
                                                                    className="h-8 text-xs"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
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
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitWifiNetwork">Red WiFi Especial</Label>
                                                            <Input
                                                                id="unitWifiNetwork"
                                                                placeholder="Red específica"
                                                                value={unitForm.extra.wifi_details.ssid}
                                                                onChange={(e) => setUnitForm({ 
                                                                    ...unitForm, 
                                                                    extra: { 
                                                                        ...unitForm.extra, 
                                                                        wifi_details: { ...unitForm.extra.wifi_details, ssid: e.target.value } 
                                                                    } 
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="unitWifiPassword">Clave WiFi Especial</Label>
                                                            <Input
                                                                id="unitWifiPassword"
                                                                placeholder="Clave específica"
                                                                value={unitForm.extra.wifi_details.pwd}
                                                                onChange={(e) => setUnitForm({ 
                                                                    ...unitForm, 
                                                                    extra: { 
                                                                        ...unitForm.extra, 
                                                                        wifi_details: { ...unitForm.extra.wifi_details, pwd: e.target.value } 
                                                                    } 
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="rooms" className="space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/30">
                                                    <div className="flex items-center gap-2">
                                                        <BedDouble className="h-4 w-4 text-indigo-500" />
                                                        <h4 className="text-xs font-bold uppercase text-slate-600">Dormitorios</h4>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Cant. Camas</Label>
                                                            <Input 
                                                                type="number" 
                                                                value={unitForm.extra.bed_room.bedsCount}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bed_room: { ...unitForm.extra.bed_room, bedsCount: parseInt(e.target.value) || 1 } }
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Tipo</Label>
                                                            <Select 
                                                                value={unitForm.extra.bed_room.type}
                                                                onValueChange={(val) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bed_room: { ...unitForm.extra.bed_room, type: val } }
                                                                })}
                                                            >
                                                                <SelectTrigger className="h-10 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {bedTypes.map(bt => (
                                                                        <SelectItem key={bt.id} value={String(bt.id)}>{bt.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/30">
                                                    <div className="flex items-center gap-2">
                                                        <Bath className="h-4 w-4 text-indigo-500" />
                                                        <h4 className="text-xs font-bold uppercase text-slate-600">Baños</h4>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Cantidad</Label>
                                                            <Input 
                                                                type="number" 
                                                                value={unitForm.extra.bath_room.count}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bath_room: { ...unitForm.extra.bath_room, count: parseInt(e.target.value) || 1 } }
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Tipo</Label>
                                                            <Select 
                                                                value={unitForm.extra.bath_room.type}
                                                                onValueChange={(val) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bath_room: { ...unitForm.extra.bath_room, type: val } }
                                                                })}
                                                            >
                                                                <SelectTrigger className="h-10 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {bathTypes.map(bt => (
                                                                        <SelectItem key={bt.id} value={String(bt.id)}>{bt.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="policies" className="space-y-4">
                                            <div className="bg-[var(--color-brand-purple)]/5 border border-[var(--color-brand-purple)]/10 rounded-xl p-4 flex gap-3">
                                                <Shield className="h-5 w-5 text-[var(--color-brand-purple)] shrink-0 mt-0.5" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-[var(--color-brand-purple)]">Políticas del Tipo de Alojamiento</p>
                                                    <p className="text-xs text-[var(--color-brand-purple)]/80 leading-relaxed">
                                                        Este tipo de habitación heredará las políticas generales de la propiedad. Puedes definir políticas específicas o excepciones en la integración final.
                                                    </p>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </ScrollArea>

                            <DialogFooter className="p-6 border-t bg-muted/5">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveUnit}
                                    className="bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold"
                                >
                                    {editingIndex !== null ? "Guardar Cambios" : "Añadir Unidad"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
                                    <TableCell className="font-bold text-[var(--color-brand-purple)]">{field.internal_name || '-'}</TableCell>
                                    <TableCell className="font-medium text-slate-900">{field.name || 'Unidad sin nombre'}</TableCell>
                                    <TableCell className="text-sm">
                                        {field.extra?.max_occupancy || 0} Huéspedes
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
                                        ${Number(field.price || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1 flex justify-end">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600" onClick={() => handleOpenEditDialog(index)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
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
