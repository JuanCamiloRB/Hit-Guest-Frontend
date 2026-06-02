"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    CalendarIcon,
    Loader2,
    Plus,
    User,
    Mail,
    Phone,
    Home,
    Tag,
    Hash,
    Users,
    DollarSign,
    Clock,
    Send,
    Plane,
} from "lucide-react"
import { format, differenceInDays, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
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
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { PhoneInputField } from "@/components/ui/phone-input-field"
import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { propertiesService } from "@/features/properties/services/properties-service"
import { listingsService } from "@/features/properties/services/listings-service"
import { catalogService } from "@/features/auth/services/catalog-service"
import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"

// ── Zod Schema ──────────────────────────────────────────────
const reservationSchema = z.object({
    // Guest Info
    guestName: z.string().min(2, "El nombre del huésped es requerido").max(120),
    guestCountry: z.string().min(1, "Selecciona el país o nacionalidad"),
    emailGuest: z.string().email("Email inválido").max(60),
    guestPhone: z.string().optional(),

    // Property & Listing
    propertyUuid: z.string().min(1, "Selecciona una propiedad"),
    listingId: z.string().min(1, "Selecciona un alojamiento"),

    // Source
    reservationSourceId: z.string().min(1, "Selecciona el canal"),

    // Dates — use z.any() for react-day-picker range compatibility
    dates: z.any().refine(
        (val: any) => val?.from instanceof Date && val?.to instanceof Date,
        { message: "Selecciona las fechas de llegada y salida" }
    ),

    // Guests count
    totalGuests: z.coerce.number().min(1, "Mínimo 1 huésped"),

    // Pricing
    totalPrice: z.coerce.number().min(0, "El precio debe ser positivo"),
    currency: z.string().min(1, "Selecciona moneda"),

    // Send link
    sendLinkNow: z.boolean().optional(),
})

type ReservationFormValues = z.infer<typeof reservationSchema>

// ── Interfaces for API data ──────────────────────────────────
interface PropertyOption {
    uuid: string
    name: string
    id: number
}

interface ListingOption {
    id: number
    uuid: string
    name: string
    propertyUuid?: string
}

interface CatalogOption {
    id: number
    name: string
    code?: string
}

// ── Component ────────────────────────────────────────────────
export function ReservationDialog() {
    const [open, setOpen] = useState(false)

    // Data from API
    const [properties, setProperties] = useState<PropertyOption[]>([])
    const [listings, setListings] = useState<ListingOption[]>([])
    const [reservationSources, setReservationSources] = useState<any[]>([])
    const [countries, setCountries] = useState<any[]>([])
    const [currencies, setCurrencies] = useState<any[]>([])

    // ── Loading States ──
    const [isLoading, setIsLoading] = useState(false)
    const [loadingProperties, setLoadingProperties] = useState(false)
    const [loadingListings, setLoadingListings] = useState(false)
    const [loadingSources, setLoadingSources] = useState(false)
    const [loadingCountries, setLoadingCountries] = useState(false)
    const [loadingCurrencies, setLoadingCurrencies] = useState(false)

    const form = useForm<ReservationFormValues>({
        resolver: zodResolver(reservationSchema) as any,
        defaultValues: {
            guestName: "",
            guestCountry: "",
            emailGuest: "",
            guestPhone: "",
            propertyUuid: "",
            listingId: "",
            reservationSourceId: "",
            dates: {
                from: undefined,
                to: undefined,
            } as any,
            totalGuests: 1,
            totalPrice: 0,
            currency: "COP",
            sendLinkNow: true,
        },
    })

    const selectedPropertyUuid = form.watch("propertyUuid")
    const selectedDates = form.watch("dates")
    const nights = selectedDates?.from && selectedDates?.to
        ? differenceInDays(selectedDates.to, selectedDates.from)
        : 0

    // ── Load Properties ──
    const loadProperties = useCallback(async () => {
        setLoadingProperties(true)
        try {
            const data = await propertiesService.list()
            setProperties(
                data.map((p: any) => ({
                    uuid: p.uuid,
                    name: p.name,
                    id: p.id,
                }))
            )
        } catch (error) {
            console.error("[ReservationDialog] Error loading properties:", error)
        } finally {
            setLoadingProperties(false)
        }
    }, [])

    // ── Load Listings by Property ──
    const loadListings = useCallback(async (propertyUuid: string) => {
        if (!propertyUuid) {
            setListings([])
            return
        }
        setLoadingListings(true)
        try {
            const data = await listingsService.listByProperty(propertyUuid)
            // Ensure data is an array
            const list = Array.isArray(data) ? data : []
            
            setListings(
                list.map((l: any) => ({
                    id: l.id,
                    uuid: l.uuid,
                    name: l.name || l.internal_name || `Alojamiento ${l.id || l.uuid.slice(0, 8)}`,
                    propertyUuid: l.property_uuid || propertyUuid,
                }))
            )
        } catch (error) {
            console.error("[ReservationDialog] Error loading listings:", error)
            setListings([])
        } finally {
            setLoadingListings(false)
        }
    }, [])

    // ── Load Reservation Sources ──
    const loadReservationSources = useCallback(async () => {
        setLoadingSources(true)
        try {
            const sources = await catalogService.getReservationSources()
            setReservationSources(
                sources.map((s: any) => ({
                    id: Number(s.id),
                    name: s.name,
                    code: s.code,
                }))
            )
        } catch (error) {
            console.error("[ReservationDialog] Error loading sources:", error)
            // Fallback values
            setReservationSources([
                { id: 14, name: "Airbnb" },
                { id: 15, name: "Booking.com" },
                { id: 16, name: "Directo" },
            ])
        } finally {
            setLoadingSources(false)
        }
    }, [])

    // ── Load Countries & Currencies ──
    const loadCountries = useCallback(async () => {
        setLoadingCountries(true)
        try {
            const data = await catalogService.getCountries()
            setCountries(data)
        } catch (error) {
            console.error("[ReservationDialog] Error loading countries:", error)
        } finally {
            setLoadingCountries(false)
        }
    }, [])

    const loadCurrencies = useCallback(async () => {
        setLoadingCurrencies(true)
        try {
            const data = await catalogService.getCurrencies()
            setCurrencies(data)
        } catch (error) {
            console.error("[ReservationDialog] Error loading currencies:", error)
        } finally {
            setLoadingCurrencies(false)
        }
    }, [])

    // ── Load data when dialog opens ──
    useEffect(() => {
        if (open) {
            loadProperties()
            loadReservationSources()
            loadCountries()
            loadCurrencies()
        }
    }, [open, loadProperties, loadReservationSources, loadCountries, loadCurrencies])

    // ── Load listings when property changes ──
    useEffect(() => {
        if (selectedPropertyUuid) {
            form.setValue("listingId", "")
            loadListings(selectedPropertyUuid)
        }
    }, [selectedPropertyUuid, loadListings, form])

    // ── Submit ──
    async function onSubmit(values: ReservationFormValues) {
        setIsLoading(true)

        // Ensure departure is at least 1 day after arrival if user only clicked once
        const departure = values.dates.to && values.dates.to > values.dates.from 
            ? values.dates.to 
            : addDays(values.dates.from, 1);

        const payload = {
            listingUuid: values.listingId, // values.listingId holds the UUID from the select
            reservationSourceId: Number(values.reservationSourceId),
            externalId: `MANUAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            arrivalDate: format(values.dates.from, "yyyy-MM-dd"),
            departureDate: format(departure, "yyyy-MM-dd"),
            emailGuest: values.emailGuest,
            totalGuests: values.totalGuests,
            currency: values.currency,
            totalPrice: values.totalPrice,
            extra: {
                guest_name: values.guestName,
                guest_country: values.guestCountry,
                guest_phone: values.guestPhone || null,
            },
            statusReservationId: 27, // 27 = Confirmada
        }

        try {
            await apiClient.post(`${API_BASE}/reservations`, payload)

            toast.success("Reserva creada exitosamente", {
                description: values.sendLinkNow
                    ? `Se enviará el link de check-in a ${values.emailGuest}`
                    : `Reserva para ${values.guestName} creada. Link no enviado.`,
            })

            setOpen(false)
            form.reset()
            window.dispatchEvent(new Event("reservationCreated"))
        } catch (error: any) {
            console.error("[ReservationDialog] Submit error:", error)
            toast.error("Error al crear la reserva", {
                description: error?.data?.message || "Intenta nuevamente",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-brand-purple hover:bg-brand-purple/90 text-white shadow-md gap-2 font-semibold">
                    <Plus size={18} />
                    Nueva Reserva
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-2xl font-bold text-slate-900">
                        Crear Reserva Manual
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Registra una nueva reserva. El huésped recibirá el link para completar su check-in online.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* ─── Section: Guest Info ─── */}
                        <div className="space-y-1">
                            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
                                <User size={14} />
                                Datos del Huésped
                            </h3>
                            <div className="h-px bg-slate-100" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FormField
                                control={form.control}
                                name="guestName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Nombre completo del huésped *</FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder="Ej: María González Pérez" 
                                                className="bg-slate-50 border-slate-200 focus-visible:ring-brand-purple/30 focus-visible:border-brand-purple rounded-xl h-11 transition-colors"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="guestCountry"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">País / Nacionalidad *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingCountries}>
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-brand-purple/30 focus:border-brand-purple rounded-xl h-11 transition-colors">
                                                    <SelectValue placeholder={loadingCountries ? "Cargando..." : "Selecciona un país"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent position="popper" className="z-[100] max-h-[300px]">
                                                {countries.map((c) => (
                                                    <SelectItem key={c.id} value={c.name}>
                                                        {c.extra?.emoji ? `${c.extra.emoji} ` : ""}{c.name}
                                                    </SelectItem>
                                                ))}
                                                {countries.length === 0 && !loadingCountries && (
                                                    <div className="px-3 py-2 text-xs text-slate-400">No hay países disponibles</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>


                        {/* ─── Section: Property & Source ─── */}
                        <div className="space-y-1.5 pt-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-blue flex items-center gap-2">
                                <Home size={14} />
                                Alojamiento y Canal
                            </h3>
                            <div className="h-px bg-gradient-to-r from-brand-blue/20 to-transparent w-full" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <FormField
                                control={form.control}
                                name="propertyUuid"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Propiedad *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingProperties}>
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-brand-blue/30 focus:border-brand-blue rounded-xl h-11 transition-colors">
                                                    <SelectValue placeholder={loadingProperties ? "Cargando..." : "Selecciona..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {properties.map((p) => (
                                                    <SelectItem key={p.uuid} value={p.uuid}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                                {properties.length === 0 && !loadingProperties && (
                                                    <div className="px-3 py-2 text-xs text-slate-400">No hay opciones</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="listingId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Alojamiento *</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={!selectedPropertyUuid || loadingListings || (!!selectedPropertyUuid && !loadingListings && listings.length === 0)}
                                        >
                                            <FormControl>
                                                <SelectTrigger className={cn(
                                                    "bg-slate-50 border-slate-200 focus:ring-brand-blue/30 focus:border-brand-blue rounded-xl h-11 transition-colors",
                                                    !!selectedPropertyUuid && !loadingListings && listings.length === 0 && "disabled:opacity-100 bg-brand-purple/5 border-brand-purple/30 text-brand-purple font-medium placeholder:text-brand-purple"
                                                )}>
                                                    <SelectValue className="text-brand-purple" placeholder={
                                                        !selectedPropertyUuid
                                                            ? "Selecciona..."
                                                            : loadingListings
                                                                ? "Cargando..."
                                                                : listings.length === 0
                                                                    ? "No listings disponibles"
                                                                    : "Selecciona..."
                                                    } />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {listings.map((l) => (
                                                    <SelectItem key={l.uuid} value={l.uuid}>
                                                        {l.name}
                                                    </SelectItem>
                                                ))}
                                                {listings.length === 0 && !loadingListings && selectedPropertyUuid && (
                                                    <div className="px-3 py-2 text-xs text-slate-400">No hay alojamientos</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="reservationSourceId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Canal de Reserva *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingSources}>
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-brand-blue/30 focus:border-brand-blue rounded-xl h-11 transition-colors">
                                                    <SelectValue placeholder={loadingSources ? "Cargando..." : "Selecciona..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {reservationSources.map((s) => (
                                                    <SelectItem key={s.id} value={String(s.id)}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* ─── Section: Dates ─── */}
                        <div className="space-y-1.5 pt-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-purple flex items-center gap-2">
                                <CalendarIcon size={14} />
                                Fechas y Huéspedes
                            </h3>
                            <div className="h-px bg-gradient-to-r from-brand-purple/20 to-transparent w-full" />
                        </div>

                        <FormField
                            control={form.control}
                            name="dates"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="font-semibold text-slate-700">Fechas de estancia *</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal justify-between rounded-xl h-11 bg-slate-50 border-slate-200 hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900",
                                                        !field.value?.from && "text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    {field.value?.from ? (
                                                        field.value.to ? (
                                                            <span>
                                                                {format(field.value.from, "d MMM yyyy", { locale: es })} — {format(field.value.to, "d MMM yyyy", { locale: es })}
                                                                {nights > 0 && (
                                                                    <span className="ml-2 text-xs bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full font-semibold">
                                                                        {nights} {nights === 1 ? "noche" : "noches"}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            format(field.value.from, "d MMM yyyy", { locale: es })
                                                        )
                                                    ) : (
                                                        <span>Seleccionar fechas</span>
                                                    )}
                                                    <CalendarIcon className="h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                selected={field.value as any}
                                                onSelect={field.onChange}
                                                numberOfMonths={2}
                                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <FormField
                                control={form.control}
                                name="totalGuests"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700 flex items-center gap-1.5">
                                            <Users size={13} className="text-brand-purple" />
                                            Huéspedes *
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                placeholder="1" 
                                                className="bg-slate-50 border-slate-200 focus-visible:ring-brand-purple/30 focus-visible:border-brand-purple rounded-xl h-11 transition-colors"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="totalPrice"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700 flex items-center gap-1.5">
                                            <DollarSign size={13} className="text-brand-purple" />
                                            Precio total *
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" min={0} step="0.01" className="bg-slate-50 border-slate-200 focus-visible:ring-brand-purple/30 focus-visible:border-brand-purple rounded-xl h-11 transition-colors" placeholder="0.00" {...field} />
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
                                        <FormLabel className="font-semibold text-slate-700">Moneda *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingCurrencies}>
                                            <FormControl>
                                                <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-brand-purple/30 focus:border-brand-purple rounded-xl h-11 transition-colors">
                                                    <SelectValue placeholder={loadingCurrencies ? "Cargando..." : "Moneda"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent position="popper" className="z-[100] max-h-[300px]">
                                                {currencies.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                                {currencies.length === 0 && !loadingCurrencies && (
                                                    <div className="px-3 py-2 text-xs text-slate-400">No hay opciones</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* ─── Contact Info ─── */}
                        <div className="space-y-1.5 pt-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-purple flex items-center gap-2">
                                <Phone size={14} />
                                Contacto y Enlace Móvil
                            </h3>
                            <div className="h-px bg-gradient-to-r from-brand-purple/20 to-transparent w-full" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FormField
                                control={form.control}
                                name="guestPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">WhatsApp / Teléfono *</FormLabel>
                                        <FormControl>
                                            <PhoneInputField 
                                                value={field.value} 
                                                onChange={field.onChange} 
                                                placeholder="300 123 4567" 
                                                disabled={isLoading} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="emailGuest"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Email (Se enviará el link ahora) *</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="email" 
                                                placeholder="huesped@email.com" 
                                                className="bg-slate-50 border-slate-200 focus-visible:ring-brand-purple/30 focus-visible:border-brand-purple rounded-xl h-11 transition-colors"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>



                        {/* ─── Send Link Toggle ─── */}
                        <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
                            <FormField
                                control={form.control}
                                name="sendLinkNow"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer">
                                                <Send size={15} className="text-brand-purple" />
                                                Enviar link de check-in ahora
                                            </FormLabel>
                                            <FormDescription className="text-[11px] text-slate-500">
                                                Se enviará un email a <span className="font-medium">{form.watch("emailGuest") || "..."}</span> con el link para completar el check-in online
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* ─── Footer ─── */}
                        <DialogFooter className="gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-brand-purple hover:bg-brand-purple/90 text-white gap-2 font-semibold min-w-[160px]"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} />
                                        Crear Reserva
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
