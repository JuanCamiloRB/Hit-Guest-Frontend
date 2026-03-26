"use client"

import { Shield, Clock, Info, CheckCircle2 } from "lucide-react"
import { useFormContext, useFieldArray } from "react-hook-form"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function PropertiesPolicies() {
    const { control, register, setValue } = useFormContext()
    const { fields, append, remove } = useFieldArray({
        control,
        name: "policies",
    })

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-[var(--color-brand-purple)]" />
                        Políticas y Reglas
                    </CardTitle>
                    <CardDescription>
                        Configura las reglas de la casa y políticas de estadía generales para esta propiedad.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Reglas de la Casa</h3>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                onClick={() => append({ name: "", description: "", type: "HOUSE_RULE" })}
                                className="h-8 border-[var(--color-brand-purple)] text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/5"
                            >
                                <Plus className="h-4 w-4 mr-1" /> Añadir Regla
                            </Button>
                        </div>

                        {fields.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50/50">
                                <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">No hay reglas personalizadas definidas.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {fields.map((field: any, index) => (
                                    <div key={field.id} className="group relative flex gap-3 p-4 bg-white border rounded-xl hover:border-indigo-200 transition-all shadow-sm">
                                        <div className="flex-1 space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Título de la Regla</Label>
                                                    <Input 
                                                        placeholder="Ej: No fumar" 
                                                        {...register(`policies.${index}.name`)} 
                                                        className="h-9"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Tipo</Label>
                                                    <Select 
                                                        defaultValue={field.type || "HOUSE_RULE"}
                                                        onValueChange={(val) => setValue(`policies.${index}.type`, val, { shouldDirty: true })}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="HOUSE_RULE">Regla de la Casa</SelectItem>
                                                            <SelectItem value="CANCELLATION">Cancelación</SelectItem>
                                                            <SelectItem value="CHECK_IN">Check-in / Check-out</SelectItem>
                                                            <SelectItem value="OTHER">Otro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción / Detalles</Label>
                                                <Input 
                                                    placeholder="Breve explicación de la regla..." 
                                                    {...register(`policies.${index}.description`)} 
                                                    className="h-9"
                                                />
                                            </div>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => remove(index)}
                                            className="h-8 w-8 text-slate-300 hover:text-destructive self-start mt-4"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Resumen Preventivo</h3>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-emerald-900">Políticas Transmitidas</p>
                                <p className="text-xs text-emerald-700 leading-relaxed">
                                    Estas políticas se enviarán automáticamente en los correos de bienvenida y se mostrarán en el portal del huésped. Asegúrate de que sean claras y concisas.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
