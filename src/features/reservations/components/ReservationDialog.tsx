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
    Edit,
} from "lucide-react"
import { format, differenceInDays, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { parseCalendarDate } from "@/lib/calendar-date"

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
import { useEffect, useState, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { propertiesService } from "@/features/properties/services/properties-service"
import { listingsService } from "@/features/properties/services/listings-service"
import { catalogService } from "@/features/auth/services/catalog-service"
import { apiClient } from "@/lib/api-client"
import { API_BASE } from "@/lib/config"
import { reservationsService } from "@/features/reservations/services/reservations-service"
import { readGuestNameParts } from "@/features/reservations/lib/guest-name"

// ── Zod Schema ──────────────────────────────────────────────
const reservationSchema = z.object({
    // Guest Info
    // Nombre y apellido separados, igual que en el resto del modelo (GuestProfile,
    // RegisteredGuest, ReservationGuest). `extra` era la única excepción y era
    // decisión del frontend: guardarlo junto obligaba a partirlo después, y
    // partir "María González Pérez" es indecidible en español.
    guestName: z.string().min(2, "El nombre del huésped es requerido").max(60),
    guestLastname: z.string().min(2, "Los apellidos son requeridos").max(60),
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
interface ReservationDialogProps {
    mode?: "create" | "edit"
    reservationUuid?: string
    trigger?: React.ReactNode
}

export function ReservationDialog({ mode = "create", reservationUuid, trigger }: ReservationDialogProps) {
    const [open, setOpen] = useState(false)
    const [isSmallScreen, setIsSmallScreen] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 640px)")
        setIsSmallScreen(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

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
            guestLastname: "",
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
            const list = Array.isArray(data) ? data : []

            // Real property reference of a listing, tolerating every shape variant.
            const propRefOf = (l: any): string | null => {
                const ref = l?.property_uuid ?? l?.propertyUuid ?? l?.property?.uuid ?? l?.property_id ?? l?.propertyId
                return ref == null ? null : String(ref)
            }

            // Defense-in-depth: the backend currently returns ALL of the PM's listings
            // ignoring the ?property_uuid= filter, so scope to the selected property
            // here. A listing with NO property ref is kept (can't attribute it), but
            // one belonging to a DIFFERENT property is dropped — that was the bug where
            // other properties' accommodations showed up in the picker.
            const scoped = list.filter((l: any) => {
                const ref = propRefOf(l)
                return ref === null || ref === String(propertyUuid)
            })

            setListings(
                scoped.map((l: any) => ({
                    id: l.id,
                    uuid: l.uuid || String(l.id),
                    name: l.name || l.internal_name || `Alojamiento ${l.id || (l.uuid || "").slice(0, 8)}`,
                    propertyUuid: propRefOf(l) ?? propertyUuid,
                }))
            )
        } catch (error) {
            console.error("[ReservationDialog] Error loading listings:", error)
            setListings([])
        } finally {
            setLoadingListings(false)
        }
    }, [])

    // On listing selection, prefill guests / price / currency with the listing's
    // configured defaults (only triggered by user choice, never by the edit-mode
    // form.reset — so an existing reservation's values aren't overwritten on load).
    const handleListingChange = useCallback(async (uuid: string) => {
        form.setValue("listingId", uuid, { shouldValidate: true, shouldDirty: true })
        try {
            const listing: any = await listingsService.getById(uuid)
            if (!listing) return
            const ex = listing.extra ?? {}
            const guests = Number(ex.maxOccupancy ?? ex.max_occupancy ?? listing.maxOccupancy ?? 0)
            const price = Number(
                ex.startPrice ?? ex.start_price ?? ex.price ??
                listing.startPrice ?? listing.start_price ?? listing.price ?? 0,
            )
            const currency = ex.currency ?? listing.currency ?? null
            if (guests > 0) form.setValue("totalGuests", guests, { shouldValidate: true, shouldDirty: true })
            if (price > 0) form.setValue("totalPrice", price, { shouldValidate: true, shouldDirty: true })
            if (currency) form.setValue("currency", String(currency), { shouldValidate: true, shouldDirty: true })
        } catch {
            // Non-fatal: keep whatever the user had if the listing can't be fetched.
        }
    }, [form])

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

    // ── Load Reservation for Edit ──
    useEffect(() => {
        if (open && mode === "edit" && reservationUuid) {
            const loadReservation = async () => {
                setIsLoading(true)
                try {
                    const raw = await reservationsService.getRawById(reservationUuid)
                    
                    // Pre-fill form
                    const fromDate = parseCalendarDate(raw.arrivalDate || raw.arrival_date)
                    const toDate = parseCalendarDate(raw.departureDate || raw.departure_date)

                    let propertyUuid = raw.listing?.property?.uuid || raw.listing?.propertyUuid || raw.listing?.property_uuid || ""
                    const listingId = raw.listing?.uuid || raw.listingId?.toString() || ""

                    // If we have listingId but no propertyUuid, we must search properties to find which one owns this listing
                    if (!propertyUuid && listingId) {
                        try {
                            const allProps = await propertiesService.list()
                            for (const prop of allProps) {
                                const propListings = await listingsService.listByProperty(prop.uuid)
                                if (propListings.some((l: any) => l.uuid === listingId || l.id === listingId)) {
                                    propertyUuid = prop.uuid
                                    break
                                }
                            }
                        } catch (err) {
                            console.error("[ReservationDialog] Failed to fetch properties to get propertyUuid", err)
                        }
                    }

                    form.reset({
                        // Una reserva antigua trae el nombre entero en `guest_name`
                        // y ningún apellido. Se carga tal cual para que el PM lo
                        // separe él: partirlo aquí por espacios daría un apellido
                        // que parece correcto y acabaría en los reportes SIRE/TRA.
                        guestName: readGuestNameParts(raw.extra).name || raw.mainGuest?.name || raw.emailGuest?.split("@")[0] || "",
                        guestLastname: readGuestNameParts(raw.extra).lastname || raw.mainGuest?.lastname || "",
                        guestCountry: raw.extra?.guestCountry || raw.extra?.guest_country || "",
                        emailGuest: raw.emailGuest || raw.email_guest || "",
                        guestPhone: raw.extra?.guestPhone || raw.extra?.guest_phone || "",
                        propertyUuid: propertyUuid,
                        listingId: listingId,
                        reservationSourceId: raw.source?.id?.toString() || raw.reservationSourceId?.toString() || raw.reservation_source_id?.toString() || "",
                        dates: {
                            from: fromDate,
                            to: toDate,
                        },
                        totalGuests: raw.totalGuests || raw.total_guests || 1,
                        totalPrice: Number(raw.totalPrice || raw.total_price || 0),
                        currency: raw.currency || "COP",
                        sendLinkNow: false,
                    })

                    if (propertyUuid) {
                        loadListings(propertyUuid)
                    }
                } catch (error) {
                    console.error("[ReservationDialog] Error loading reservation for edit:", error)
                    notifyError(error, "Error al cargar los datos de la reserva")
                } finally {
                    setIsLoading(false)
                }
            }
            loadReservation()
        } else if (open && mode === "create") {
            form.reset({
                guestName: "", guestLastname: "", guestCountry: "", emailGuest: "", guestPhone: "",
                propertyUuid: "", listingId: "", reservationSourceId: "",
                dates: { from: undefined, to: undefined } as any,
                totalGuests: 1, totalPrice: 0, currency: "COP", sendLinkNow: true,
            })
        }
    }, [open, mode, reservationUuid, loadListings, form])

    // ── Load listings when property changes ──
    useEffect(() => {
        if (selectedPropertyUuid) {
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
            listingUuid: values.listingId,
            listing_uuid: values.listingId,
            listingId: values.listingId,
            listing_id: values.listingId,
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
                guest_lastname: values.guestLastname,
                guest_country: values.guestCountry,
                // El selector de país itera el catálogo (que trae `c.id`) pero
                // guardaba solo `c.name`, tirando el id. Ese id es el mismo
                // `nationalityId` que pide el check-in, así que perderlo obligaba
                // a resolver el país por texto más adelante. Se manda junto al
                // nombre — aditivo, sin romper lo que ya lee `guest_country`.
                guest_country_id: countries.find((c) => c.name === values.guestCountry)?.id ?? null,
                guest_phone: values.guestPhone || null,
            },
            statusReservationId: 27, // 27 = Confirmada
        }

        try {
            if (mode === "edit" && reservationUuid) {
                // Ensure we don't send extra id fields if not needed, but keep payload simple
                await reservationsService.update(reservationUuid, payload)
                toast.success("Reserva actualizada exitosamente", {
                    description: "Los cambios han sido guardados.",
                })
            } else {
                await apiClient.post(`${API_BASE}/reservations`, payload)
                toast.success("Reserva creada exitosamente", {
                    description: values.sendLinkNow
                        ? `Se enviará el link de check-in a ${values.emailGuest}`
                        : `Reserva para ${values.guestName} ${values.guestLastname} creada. Link no enviado.`,
                })
            }

            setOpen(false)
            form.reset()
            window.dispatchEvent(new Event("reservationCreated"))
        } catch (error: any) {
            console.error("[ReservationDialog] Submit error:", error)
            // El fallback distingue el modo: al editar decía "Error al crear la
            // reserva". Importa más ahora que el botón de editar dejó de bloquear
            // por canal — si el backend rechaza una reserva sincronizada, este es
            // el mensaje que lo cuenta, y `notifyError` ya prefiere el texto del
            // backend cuando viene.
            notifyError(error, mode === "edit" ? "Error al actualizar la reserva" : "Error al crear la reserva")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button className="bg-brand-purple hover:bg-brand-purple/90 text-white shadow-md gap-2 font-semibold">
                        <Plus size={18} />
                        Nueva Reserva
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-2xl font-bold text-slate-900">
                        {mode === "edit" ? "Editar Reserva Manual" : "Crear Reserva Manual"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        {mode === "edit" 
                            ? "Edita los detalles de la reserva seleccionada." 
                            : "Registra una nueva reserva. El huésped recibirá el link para completar su check-in online."}
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
                                        <FormLabel className="font-semibold text-slate-700">Nombres del huésped *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: María"
                                                autoComplete="given-name"
                                                className="bg-slate-50 border-slate-200 focus-visible:ring-brand-purple/30 focus-visible:border-brand-purple rounded-xl h-11 transition-colors"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {/* Separado del nombre a propósito: así viaja partido a
                                `extra` y el check-in del titular puede precargarlo.
                                Con un solo campo habría que adivinar dónde acaba el
                                nombre, y esto alimenta reportes SIRE/TRA. */}
                            <FormField
                                control={form.control}
                                name="guestLastname"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Apellidos del huésped *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej: González Pérez"
                                                autoComplete="family-name"
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

                        {/* Property gets its own full-width row (names are long, e.g.
                            "KeyPöint Retreat | Green Höuse"); Alojamiento + Canal share
                            a 2-column row so none of the three selects get cramped. */}
                        <div className="space-y-5">
                            <FormField
                                control={form.control}
                                name="propertyUuid"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Propiedad *</FormLabel>
                                        <Select 
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                form.setValue("listingId", "");
                                            }} 
                                            value={field.value} 
                                            disabled={loadingProperties}
                                        >
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <FormField
                                control={form.control}
                                name="listingId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-semibold text-slate-700">Alojamiento *</FormLabel>
                                        <Select
                                            onValueChange={handleListingChange}
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
                                                numberOfMonths={isSmallScreen ? 1 : 2}
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
                                        {mode === "edit" ? "Guardando..." : "Creando..."}
                                    </>
                                ) : (
                                    <>
                                        {mode === "edit" ? <Edit size={16} /> : <Plus size={16} />}
                                        {mode === "edit" ? "Guardar Cambios" : "Crear Reserva"}
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
