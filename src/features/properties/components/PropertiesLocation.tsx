"use client"

import { MapPin, Globe, Search, Loader2 } from "lucide-react"
import { useFormContext } from "react-hook-form"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const MapComponent = dynamic(() => import("./MapComponent"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center w-full h-full bg-slate-100 animate-pulse rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
    )
})

export function PropertiesLocation() {
    const form = useFormContext()
    const [isSearching, setIsSearching] = useState(false)

    // Using flat structure from PropertyFormData
    const lat = form.watch("latitude") || 10.3910
    const lng = form.watch("longitude") || -75.4794

    const handleMapChange = useCallback((newLat: number, newLng: number) => {
        form.setValue("latitude", newLat, { shouldValidate: true, shouldDirty: true })
        form.setValue("longitude", newLng, { shouldValidate: true, shouldDirty: true })
    }, [form])

    const handleGeocode = async () => {
        const address = form.getValues("address")
        const city = form.getValues("city")
        const state = form.getValues("state")

        if (!address && !city) {
            toast.error("Dirección insuficiente", {
                description: "Por favor ingresa al menos una dirección o ciudad para buscar.",
            })
            return
        }

        setIsSearching(true)
        try {
            const query = encodeURIComponent(`${address}, ${city}, ${state}, Colombia`)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`)
            const data = await response.json()

            if (data && data.length > 0) {
                const result = data[0]
                const newLat = parseFloat(result.lat)
                const newLng = parseFloat(result.lon)

                form.setValue("latitude", newLat)
                form.setValue("longitude", newLng)

                toast.success("Ubicación encontrada", {
                    description: "El marcador se ha movido a la dirección encontrada.",
                })
            } else {
                toast.error("No se encontró la ubicación", {
                    description: "Intenta con una dirección más específica o mueve el pin manualmente.",
                })
            }
        } catch (error) {
            toast.error("Error de búsqueda", {
                description: "No se pudo conectar con el servicio de mapas.",
            })
        } finally {
            setIsSearching(false)
        }
    }

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[var(--color-brand-purple)]" />
                    Ubicación de la Propiedad
                </CardTitle>
                <CardDescription>
                    Ubica tu propiedad en el mapa. Puedes buscar la dirección o arrastrar el pin manualmente para precisión exacta.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="flex gap-2 items-end">
                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel className="text-slate-700 font-semibold">Dirección Principal <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="pl-9 h-11 border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                                            placeholder="Calle 123 #12-34..."
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        className="h-11 px-6 bg-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/90 text-white font-bold transition-all shadow-sm"
                        onClick={handleGeocode}
                        disabled={isSearching}
                    >
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Search className="h-4 w-4 mr-2 text-white" />}
                        Buscar
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="addressDetail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Dirección Línea 2 (Opcional)</FormLabel>
                                <FormControl>
                                    <Input className="h-11 border-slate-200" placeholder="Apto, Suite, etc." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Estado/Depto <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <Input className="h-11 border-slate-200" placeholder="Bolívar" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="aspect-video w-full rounded-xl bg-slate-100 border-2 border-slate-200 relative overflow-hidden shadow-inner group">
                    <MapComponent lat={Number(lat)} lng={Number(lng)} onChange={handleMapChange} />
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge className="bg-white/90 text-[var(--color-brand-purple)] border border-[var(--color-brand-purple)]/20 shadow-sm backdrop-blur-sm px-3 py-1 font-bold">
                            Arrastra el pin para ajustar
                        </Badge>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Ciudad <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <Input
                                        className="h-11 border-slate-200"
                                        placeholder="Cartagena"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                         control={form.control}
                         name="countryId"
                         render={({ field }) => (
                             <FormItem>
                                 <FormLabel className="text-slate-700 font-semibold">País (ID) <span className="text-destructive">*</span></FormLabel>
                                 <FormControl>
                                     <Input
                                         type="number"
                                         className="h-11 border-slate-200"
                                         placeholder="48"
                                         {...field}
                                         onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                     />
                                 </FormControl>
                                 <FormMessage />
                             </FormItem>
                         )}
                    />
                     <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Zona Horaria</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input className="pl-9 h-11 border-slate-200" {...field} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="bg-[var(--color-brand-purple)]/5 p-4 rounded-xl border border-[var(--color-brand-purple)]/10 space-y-3">
                    <p className="text-xs font-bold text-[var(--color-brand-purple)] uppercase tracking-widest">Coordenadas Exactas</p>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="latitude"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] text-slate-500 uppercase">Latitud</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            className="h-10 bg-white border-slate-200"
                                            {...field}
                                            value={field.value ?? ""}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="longitude"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] text-slate-500 uppercase">Longitud</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            className="h-10 bg-white border-slate-200"
                                            {...field}
                                            value={field.value ?? ""}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Estas coordenadas se actualizan automáticamente al mover el pin en el mapa.</p>
                </div>
            </CardContent>
        </Card>
    )
}
