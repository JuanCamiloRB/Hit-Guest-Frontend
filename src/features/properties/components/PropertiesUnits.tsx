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
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { listingsService } from "../services/listings-service"

const defaultUnit = {
    name: "",
    internalName: "",
    roomTypeId: 1,
    thumbnailUrl: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=60",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    statusRecordId: 6,
    isActive: true,
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
        inheritWifi: true,
        inheritSchedule: true,
        inheritPolicies: true,
    },
    price: "",
}

export function PropertiesUnits() {
    const { control, watch } = useFormContext()
    const propWifiNetwork = watch("wifiNetwork")
    const propWifiPassword = watch("wifiPassword")
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

    useEffect(() => {
        catalogService.getRoomTypes().then((rooms) => {
            if (rooms.length > 0) setRoomTypes(rooms)
        })
        catalogService.getCurrencies().then((curr) => {
            if (curr.length > 0) setCurrencies(curr)
        })
    }, [])

    const handleOpenAddDialog = () => {
        setUnitForm({ ...defaultUnit })
        setEditingIndex(null)
        setIsDialogOpen(true)
    }

    const handleOpenEditDialog = (index: number) => {
        const raw = fields[index] as any
        // Normalize: API returns nested objects; flatten to camelCase for the form
        const normalized = {
            ...raw,
            internalName:  raw.internalName  || raw.internal_name  || "",
            // API returns roomType: { id, name } — flatten to roomTypeId
            roomTypeId:    raw.roomType?.id  || raw.roomTypeId    || raw.room_type_id    || 1,
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
            extra: {
                ...defaultUnit.extra,
                ...(raw.extra || {}),
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
        setIsDialogOpen(true)
    }

    const handleSaveUnit = async () => {
        if (!unitForm.name || unitForm.name.trim().length < 2) {
            toast.error("El nombre de la unidad es requerido", {
                description: "Por favor asigna un nombre de al menos 2 caracteres.",
            })
            return
        }

        // ── Existing property: persist via API immediately ──
        if (propertyUuid) {
            try {
                // Build the payload matching POST /listings schema
                const { extra = {} as any, ...rest } = unitForm as any
                const {
                    inheritWifi,
                    inheritSchedule,
                    inheritPolicies,
                    wifiDetails,
                    checkIn,
                    checkOut,
                    cancellationPolicy,
                    ...cleanExtra
                } = extra

                if (!inheritWifi)      cleanExtra.wifiDetails = wifiDetails
                if (!inheritSchedule)  { cleanExtra.checkIn = checkIn; cleanExtra.checkOut = checkOut }
                if (!inheritPolicies)  cleanExtra.cancellationPolicy = cancellationPolicy

                // Store price purely inside extra as requested by the backend
                const unitPrice = Number(unitForm.price) || 0
                cleanExtra.startPrice = unitPrice

                const payload = {
                    propertyUuid,
                    name:          rest.name,
                    internalName:  rest.internalName  || undefined,
                    roomTypeId:    Number(rest.roomTypeId) || 1,
                    description:   rest.description   || undefined,
                    thumbnailUrl:  rest.thumbnailUrl   || undefined,
                    contactName:   rest.contactName    || undefined,
                    contactEmail:  rest.contactEmail   || undefined,
                    contactPhone:  rest.contactPhone   || undefined,
                    statusRecordId: unitForm.isActive !== false ? 6 : 7,
                    extra: cleanExtra,
                }

                // UPDATE also needs price at top-level (PUT /listings accepts it; POST does not)
                const updatePayload = { ...payload, price: unitPrice, start_price: unitPrice }

                if (editingIndex !== null && (unitForm as any).uuid) {
                    // UPDATE existing listing — use updatePayload which includes root-level price (PUT accepts it)
                    const updated = await listingsService.update((unitForm as any).uuid, updatePayload as any)
                    const apiData = updated?.data || {}
                    // Rebuild local state: price comes from extra.startPrice
                    const refreshed = {
                        ...unitForm,
                        ...apiData,
                        roomTypeId:    apiData.roomType?.id    || unitForm.roomTypeId,
                        contactName:   apiData.contact?.name   || unitForm.contactName,
                        contactEmail:  apiData.contact?.email  || unitForm.contactEmail,
                        contactPhone:  apiData.contact?.phone  || unitForm.contactPhone,
                        isActive:      apiData.statusRecord ? apiData.statusRecord.id === 6 : unitForm.isActive,
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
                    const apiData = created?.data || {}
                    const savedUnit = {
                        ...unitForm,
                        uuid: apiData.uuid || created?.uuid,
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
                    toast.success("Unidad creada correctamente")
                }
            } catch (err) {
                console.error("[PropertiesUnits] Error saving listing:", err)
                toast.error("Error al guardar la unidad", {
                    description: "Intenta de nuevo o guarda la propiedad completa.",
                })
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
                toast.error("Error al eliminar la unidad")
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
                                                        value={unitForm.name ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="internalName">Nombre Interno / Número</Label>
                                                    <Input
                                                        id="internalName"
                                                        placeholder="Ej. SJ-101"
                                                        value={unitForm.internalName ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, internalName: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="roomTypeId">Categoría del Alojamiento</Label>
                                                    <Select
                                                        value={String(unitForm.roomTypeId)}
                                                        onValueChange={(value) => setUnitForm({ ...unitForm, roomTypeId: parseInt(value) })}
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
                                                        value={unitForm.extra.maxOccupancy ?? 2}
                                                        onChange={(e) => setUnitForm({ 
                                                            ...unitForm, 
                                                            extra: { ...unitForm.extra, maxOccupancy: parseInt(e.target.value) || 0 } 
                                                        })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
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
                                                        placeholder="250000"
                                                        value={unitForm.price ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactName">Nombre de Contacto</Label>
                                                    <Input
                                                        id="contactName"
                                                        placeholder="Nombre del encargado"
                                                        value={unitForm.contactName ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactName: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactPhone">Teléfono de Contacto</Label>
                                                    <Input
                                                        id="contactPhone"
                                                        placeholder="+57..."
                                                        value={unitForm.contactPhone ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactPhone: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="contactEmail">Correo Electrónico <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        id="contactEmail"
                                                        type="email"
                                                        placeholder="ejemplo@kunas.co"
                                                        value={unitForm.contactEmail ?? ""}
                                                        onChange={(e) => setUnitForm({ ...unitForm, contactEmail: e.target.value })}
                                                    />
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
                                                    <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border">
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
                                                    <div className="grid grid-cols-2 gap-4">
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
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/30">
                                                    <div className="flex items-center gap-2">
                                                        <BedDouble className="h-4 w-4 text-indigo-500" />
                                                        <h4 className="text-xs font-bold uppercase text-slate-600">Dormitorios</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Cant. Habitaciones / Camas</Label>
                                                            <Input 
                                                                type="number" 
                                                                value={unitForm.extra.bedRoom ?? 1}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bedRoom: parseInt(e.target.value) || 1 }
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/30">
                                                    <div className="flex items-center gap-2">
                                                        <Bath className="h-4 w-4 text-indigo-500" />
                                                        <h4 className="text-xs font-bold uppercase text-slate-600">Baños</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px]">Cantidad</Label>
                                                            <Input 
                                                                type="number" 
                                                                value={unitForm.extra.bathRoom ?? 1}
                                                                onChange={(e) => setUnitForm({
                                                                    ...unitForm,
                                                                    extra: { ...unitForm.extra, bathRoom: parseInt(e.target.value) || 1 }
                                                                })}
                                                            />
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
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600" onClick={() => handleOpenEditDialog(index)}>
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
