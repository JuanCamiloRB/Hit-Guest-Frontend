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

    // Default to Cartagena, Colombia if no lat/lng
    const lat = form.watch("geoLocation.latitude") || 10.3910
    const lng = form.watch("geoLocation.longitude") || -75.4794

    const handleMapChange = useCallback((newLat: number, newLng: number) => {
        form.setValue("geoLocation.latitude", newLat, { shouldValidate: true, shouldDirty: true })
        form.setValue("geoLocation.longitude", newLng, { shouldValidate: true, shouldDirty: true })
    }, [form])

    const handleGeocode = async () => {
        const address = form.getValues("address.line1")
        const city = form.getValues("address.city")
        const country = form.getValues("address.country")

        if (!address && !city) {
            toast.error("Dirección insuficiente", {
                description: "Por favor ingresa al menos una dirección o ciudad para buscar.",
            })
            return
        }

        setIsSearching(true)
        try {
            const query = encodeURIComponent(`${address}, ${city}, ${country}`)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`)
            const data = await response.json()

            if (data && data.length > 0) {
                const result = data[0]
                const newLat = parseFloat(result.lat)
                const newLng = parseFloat(result.lon)

                form.setValue("geoLocation.latitude", newLat)
                form.setValue("geoLocation.longitude", newLng)

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
            <CardContent className="space-y-6">
                <div className="flex gap-2 items-end">
                    <FormField
                        control={form.control}
                        name="address.line1"
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
                        name="address.line2"
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
                        name="address.postal_code"
                        render={({ field }) => (
                            <FormItem>
<<<<<<< Updated upstream
                                <FormLabel className="text-slate-700 font-semibold">Código Postal</FormLabel>
=======
                                <FormLabel className="text-slate-700 font-semibold">Estado/Depto <span className="text-destructive">*</span></FormLabel>
>>>>>>> Stashed changes
                                <FormControl>
                                    <Input className="h-11 border-slate-200" placeholder="130001" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="aspect-video w-full rounded-xl bg-slate-100 border-2 border-slate-200 relative overflow-hidden shadow-inner group">
                    <MapComponent lat={lat} lng={lng} onChange={handleMapChange} />
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <Badge className="bg-white/90 text-[var(--color-brand-purple)] border border-[var(--color-brand-purple)]/20 shadow-sm backdrop-blur-sm px-3 py-1 font-bold">
                            Arrastra el pin para ajustar
                        </Badge>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="address.city"
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
                        name="address.state"
                        render={({ field }) => (
                            <FormItem>
<<<<<<< Updated upstream
                                <FormLabel className="text-slate-700 font-semibold">Estado/Depto</FormLabel>
=======
                                <FormLabel className="text-slate-700 font-semibold">País (ID) <span className="text-destructive">*</span></FormLabel>
>>>>>>> Stashed changes
                                <FormControl>
                                    <Input
                                        className="h-11 border-slate-200"
                                        placeholder="Bolívar"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="address.country"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">País</FormLabel>
                                <FormControl>
                                    <Input
                                        className="h-11 border-slate-200"
                                        placeholder="Colombia"
                                        {...field}
                                    />
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
                            name="geoLocation.latitude"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] text-slate-500 uppercase">Latitud</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            className="h-10 bg-white border-slate-200"
                                            {...field}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="geoLocation.longitude"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] text-slate-500 uppercase">Longitud</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            className="h-10 bg-white border-slate-200"
                                            {...field}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Estas coordenadas se actualizan automáticamente al mover el pin en el mapa.</p>
                </div>

                <FormField
                    control={form.control}
                    name="timeZone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Zona Horaria (Confirmar)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input className="pl-9 h-11 border-slate-200" {...field} />
                                </div>
                            </FormControl>
                            <FormDescription>Detectada automáticamente, por favor confirma que sea correcta.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    )
}
