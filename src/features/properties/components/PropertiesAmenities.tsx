"use client"

import { useFormContext } from "react-hook-form"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { Sparkles } from "lucide-react"
<<<<<<< Updated upstream
=======
import { useEffect, useState } from "react"
import { catalogsService as catalogService, CatalogOption } from "@/services/catalogs-service"
>>>>>>> Stashed changes
import { cn } from "@/lib/utils"

const commonAmenities = [
    { id: "wifi", label: "WiFi" },
    { id: "pool", label: "Piscina" },
    { id: "parking", label: "Parqueo Gratis" },
    { id: "ac", label: "Aire Acondicionado" },
    { id: "kitchen", label: "Cocina" },
    { id: "tv", label: "TV" },
    { id: "washer", label: "Lavadora" },
    { id: "dryer", label: "Secadora" },
    { id: "heating", label: "Calefacción" },
    { id: "workspace", label: "Zona de Trabajo" },
    { id: "gym", label: "Gimnasio" },
    { id: "pet_friendly", label: "Se admiten mascotas" },
]

export function PropertiesAmenities() {
    const form = useFormContext()

    return (
        <Card>
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Sparkles className="h-5 w-5 text-[var(--color-brand-purple)]" />
                    Amenidades de la Propiedad
                </CardTitle>
                <CardDescription>Selecciona las características y servicios incluidos en este alojamiento.</CardDescription>
            </CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="amenities"
                    render={() => (
                        <FormItem>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                {commonAmenities.map((item) => (
                                    <FormField
                                        key={item.id}
                                        control={form.control}
                                        name="amenities"
                                        render={({ field }) => {
                                            return (
                                                <FormItem
                                                    key={item.id}
                                                    className="data-[state=checked]:bg-[var(--color-brand-purple)] data-[state=checked]:border-[var(--color-brand-purple)] rounded-md border p-4"
                                                >
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                    ? field.onChange([...(field.value || []), item.id])
                                                                    : field.onChange(
                                                                        field.value?.filter(
                                                                            (value: string) => value !== item.id
                                                                        )
                                                                    )
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal cursor-pointer text-sm w-full leading-snug">
                                                        {item.label}
                                                    </FormLabel>
                                                </FormItem>
                                            )
                                        }}
                                    />
                                ))}
                            </div>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
