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
import { Sparkles, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { catalogService, CatalogOption } from "@/features/auth/services/catalog-service"
import { cn } from "@/lib/utils"

export function PropertiesAmenities() {
    const form = useFormContext()
    const [amenities, setAmenities] = useState<CatalogOption[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchAmenities = async () => {
            setIsLoading(true)
            try {
                const data = await catalogService.getAmenities()
                setAmenities(data)
            } catch (error) {
                console.error("Error fetching amenities:", error)
            } finally {
                setIsLoading(false)
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
            <CardContent className="pt-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-purple)]" />
                        <span className="ml-2 text-sm text-slate-500">Cargando amenidades...</span>
                    </div>
                ) : (
                    <FormField
                        control={form.control}
                        name="amenities"
                        render={() => (
                            <FormItem>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                    {amenities.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="amenities"
                                            render={({ field }) => {
                                                const isChecked = (field.value || []).includes(String(item.id))
                                                return (
                                                    <FormItem
                                                        key={item.id}
                                                        className={cn(
                                                            "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 transition-colors hover:bg-slate-50",
                                                            isChecked && "bg-indigo-50/30 border-indigo-200"
                                                        )}
                                                    >
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={isChecked}
                                                                onCheckedChange={(checked) => {
                                                                    const currentValues = field.value || []
                                                                    const newValue = checked
                                                                        ? [...currentValues, String(item.id)]
                                                                        : currentValues.filter((v: string) => v !== String(item.id))
                                                                    field.onChange(newValue)
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="text-sm font-medium leading-none cursor-pointer">
                                                            {item.name}
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
                )}
            </CardContent>
        </Card>
    )
}
