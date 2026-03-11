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
import { Plus, Trash2, Edit2, Building } from "lucide-react"
import { useFormContext, useFieldArray } from "react-hook-form"
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const defaultUnit = {
    name: "",
    number: "",
    type: "ENTIRE_PLACE",
    capacity: 1,
    price: "",
    airbnbCode: "",
    icalUrl: "",
    isActive: true,
    inheritWifi: true,
    wifiNetwork: "",
    wifiPassword: "",
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
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{editingIndex !== null ? "Editar Unidad" : "Añadir Unidad"}</DialogTitle>
                                <DialogDescription>
                                    Configura los detalles del alojamiento.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Nombre de Unidad</Label>
                                        <Input
                                            id="name"
                                            placeholder="Suite Junior"
                                            value={unitForm.name}
                                            onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="number">Número de Unidad</Label>
                                        <Input
                                            id="number"
                                            placeholder="Ej. 101"
                                            value={unitForm.number}
                                            onChange={(e) => setUnitForm({ ...unitForm, number: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="type">Tipo</Label>
                                        <Select
                                            value={unitForm.type}
                                            onValueChange={(value) => setUnitForm({ ...unitForm, type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ENTIRE_PLACE">Alojamiento Entero</SelectItem>
                                                <SelectItem value="PRIVATE_ROOM">Habitación Privada</SelectItem>
                                                <SelectItem value="SHARED_ROOM">Cama / Compartido</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="capacity">Capacidad de Huéspedes</Label>
                                        <Input
                                            id="capacity"
                                            type="number"
                                            value={unitForm.capacity}
                                            onChange={(e) => setUnitForm({ ...unitForm, capacity: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">Configuración de WiFi</Label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Heredar de Propiedad</span>
                                            <Switch
                                                checked={unitForm.inheritWifi}
                                                onCheckedChange={(checked) => setUnitForm({ ...unitForm, inheritWifi: checked })}
                                            />
                                        </div>
                                    </div>

                                    {unitForm.inheritWifi ? (
                                        <div className="p-3 bg-[var(--color-brand-purple)]/5 border border-[var(--color-brand-purple)]/10 rounded-lg space-y-1">
                                            <p className="text-[10px] text-[var(--color-brand-purple)] font-bold uppercase tracking-wider">Información Heredada</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div><span className="text-muted-foreground">Red:</span> <span className="font-medium text-slate-700">{propWifiNetwork || 'No definida'}</span></div>
                                                <div><span className="text-muted-foreground">Clave:</span> <span className="font-medium text-slate-700">{propWifiPassword || 'No definida'}</span></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="unitWifiNetwork">Red WiFi Especial</Label>
                                                <Input
                                                    id="unitWifiNetwork"
                                                    placeholder="Red específica"
                                                    value={unitForm.wifiNetwork}
                                                    onChange={(e) => setUnitForm({ ...unitForm, wifiNetwork: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="unitWifiPassword">Clave WiFi Especial</Label>
                                                <Input
                                                    id="unitWifiPassword"
                                                    placeholder="Clave específica"
                                                    value={unitForm.wifiPassword}
                                                    onChange={(e) => setUnitForm({ ...unitForm, wifiPassword: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                    <div className="grid gap-2">
                                        <Label htmlFor="price">Precio por Noche (COP)</Label>
                                        <Input
                                            id="price"
                                            placeholder="250000"
                                            value={unitForm.price}
                                            onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="airbnbCode">Código en la OTA</Label>
                                        <Input
                                            id="airbnbCode"
                                            placeholder="12345678"
                                            value={unitForm.airbnbCode}
                                            onChange={(e) => setUnitForm({ ...unitForm, airbnbCode: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
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
                            <TableHead className="w-[80px]">Número</TableHead>
                            <TableHead>Nombre / Alojamiento</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Capacidad</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="w-[100px] text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                    Aún no hay unidades. Haz clic en "Añadir Unidad" para crear una.
                                </TableCell>
                            </TableRow>
                        ) : (
                            fields.map((field: any, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-bold text-[var(--color-brand-purple)]">{field.number || '-'}</TableCell>
                                    <TableCell className="font-medium text-slate-900">{field.name || 'Unidad sin nombre'}</TableCell>
                                    <TableCell className="text-xs text-slate-500">
                                        {field.type === 'ENTIRE_PLACE' ? 'Alojamiento Entero' :
                                            field.type === 'PRIVATE_ROOM' ? 'Habitación Privada' : 'Compartido'}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {field.capacity} {field.capacity === 1 ? 'Huésped' : 'Huéspedes'}
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
                                    <TableCell className="text-right font-semibold">
                                        ${field.price?.toLocaleString()}
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
