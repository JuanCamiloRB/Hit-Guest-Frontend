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
import { useEffect, useState } from "react"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { cn } from "@/lib/utils"
import { PropertyFormData } from "../types"

export function PropertiesAmenities() {
    const { control, watch, setValue } = useFormContext<PropertyFormData>()
    const [amenities, setAmenities] = useState<CatalogOption[]>([])

    useEffect(() => {
        const fetchAmenities = async () => {
            const list = await catalogService.getAmenities()
            if (list.length > 0) {
                setAmenities(list)
            } else {
                setAmenities([
                    { id: "wifi", name: "WiFi" },
                    { id: "pool", name: "Piscina" },
                    { id: "parking", name: "Parqueo Gratis" },
                    { id: "ac", name: "Aire Acondicionado" },
                    { id: "kitchen", name: "Cocina" },
                    { id: "tv", name: "TV" },
                    { id: "washer", name: "Lavadora" },
                    { id: "dryer", name: "Secadora" },
                    { id: "heating", name: "Calefacción" },
                    { id: "workspace", name: "Zona de Trabajo" },
                    { id: "gym", name: "Gimnasio" },
                    { id: "pet_friendly", name: "Se admiten mascotas" },
                ])
            }
        }
        fetchAmenities()
    }, [])

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
                    control={control}
                    name="amenities"
                    render={() => (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {amenities.map((item) => (
                                <FormField
                                    key={item.id}
                                    control={control}
                                    name="amenities"
                                    render={({ field }) => (
                                        <FormItem
                                            key={item.id}
                                            className="data-[state=checked]:bg-[var(--color-brand-purple)] data-[state=checked]:border-[var(--color-brand-purple)] rounded-md border p-4"
                                        >
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value?.includes(item.id)}
                                                    onCheckedChange={(checked) => {
                                                        const current = field.value || [];
                                                        const next = checked
                                                            ? [...current, item.id]
                                                            : current.filter((val: any) => val !== item.id);
                                                        field.onChange(next);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal cursor-pointer text-sm w-full leading-snug">
                                                {item.name}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                    )}
                />
            </CardContent>
        </Card>
    )
}
