"use client"

import React, { useEffect, useState } from "react"
import { reservationsService, ReservationDetailData } from "../services/reservations-service"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    Printer,
    Edit,
    ChevronRight,
    Send,
    Copy,
    MessageSquare,
    CreditCard,
    Calendar,
    Home,
    FileText,
    Loader2,
    Users,
} from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { COMMUNICATION_LOCALES, LOCALE_LABELS, type CommunicationLocale } from "@/lib/locales"
import { ReservationDialog } from "./ReservationDialog"
import { AutomationStatusList } from "./automations"
import { GuestDocumentsCard } from "./GuestDocumentsCard"
import { PropertyDocumentsCard } from "./PropertyDocumentsCard"
import Link from "next/link"

export function OperationsPanel({ reservationId }: { reservationId: string }) {
    const [data, setData] = useState<ReservationDetailData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSendingLink, setIsSendingLink] = useState(false)
    const [sendDialogOpen, setSendDialogOpen] = useState(false)
    const [recipientEmail, setRecipientEmail] = useState("")
    // "default" => omit locale (use property's configured language).
    const [localeChoice, setLocaleChoice] = useState<"default" | CommunicationLocale>("default")

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const result = await reservationsService.getById(reservationId)
                if (mounted) setData(result)
            } catch (e: any) {
                console.error("[OperationsPanel] Error loading reservation:", e)
                if (mounted) setError(e.message || "Error al cargar la reserva")
            } finally {
                if (mounted) setIsLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [reservationId])

    // Prefill recipient with the main guest's email and reset the language to the
    // property default each time the dialog opens.
    const openSendDialog = (open: boolean) => {
        if (open) {
            setRecipientEmail(data?.email ?? "")
            setLocaleChoice("default")
        }
        setSendDialogOpen(open)
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())

    // Sends the check-in link email. `email` overrides the recipient; `locale`
    // omitted ("default") means the backend uses the property's configured language.
    const handleSendCheckinLink = async () => {
        if (isSendingLink || !isValidEmail) return
        setIsSendingLink(true)
        try {
            const message = await reservationsService.sendCheckinLink(reservationId, {
                email: recipientEmail.trim(),
                locale: localeChoice === "default" ? undefined : localeChoice,
            })
            toast.success(message)
            setSendDialogOpen(false)
        } catch (e) {
            notifyError(e, "No se pudo enviar el link de check-in.")
        } finally {
            setIsSendingLink(false)
        }
    }

    // Fallback: copy the guest check-in link (frontend URL) to share manually.
    const handleCopyCheckinLink = async () => {
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        const link = `${origin}/checkin/${reservationId}`
        try {
            await navigator.clipboard.writeText(link)
            toast.success("Link de check-in copiado", { description: "Pégalo en WhatsApp o correo para enviarlo al huésped." })
        } catch {
            toast.error("No se pudo copiar el link", { description: link })
        }
    }

    // Opens the PM's email client to message the guest. No in-app messaging
    // endpoint exists yet, so mailto is the pragmatic real action (vs a dead button).
    const handleMessageGuest = () => {
        const email = data?.email?.trim()
        if (!email) {
            toast.error("El huésped no tiene correo registrado.")
            return
        }
        const subject = encodeURIComponent(`Tu reserva ${data?.externalId ?? ""}`.trim())
        const body = encodeURIComponent(`Hola ${data?.guestName ?? ""},\n\n`)
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer")
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh] gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={24} />
                <span className="text-sm font-medium">Cargando reserva...</span>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <p className="text-slate-500 text-sm">{error || "Reserva no encontrada"}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6 max-w-7xl mx-auto pb-10">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center text-xs font-medium text-slate-500 gap-1.5">
                        <Link href="/dashboard/reservations" className="hover:text-primary transition-colors">
                            Operaciones
                        </Link>
                        <ChevronRight size={12} className="text-slate-400" />
                        <span className="text-primary font-semibold truncate max-w-[160px] sm:max-w-none inline-block align-bottom">Reserva {data.externalId || `${reservationId.slice(0, 8)}...`}</span>
                    </div>
                    <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">Panel de Operaciones</h1>
                    <p className="text-sm text-slate-500">Gestión detallada de la reserva y automatizaciones</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button onClick={() => window.print()} variant="outline" className="bg-white border-slate-200 text-slate-700 shadow-sm gap-2 text-xs sm:text-sm">
                        <Printer size={16} />
                        Imprimir
                    </Button>
                    <ReservationDialog 
                        mode="edit" 
                        reservationUuid={reservationId}
                        trigger={
                            <Button 
                                className="bg-primary hover:bg-primary text-white shadow-md gap-2 text-xs sm:text-sm"
                                disabled={data.source === "Airbnb"}
                                title={data.source === "Airbnb" ? "Las reservas de Airbnb no se pueden editar manualmente" : "Editar los detalles de la reserva"}
                            >
                                <Edit size={16} />
                                Editar Reserva
                            </Button>
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Guest & Reservation Info Card */}
                    <Card className="border-fuchsia-200 border-2 overflow-hidden shadow-sm">
                        <CardContent className="p-4 sm:p-6">
                            {/* Top row: Guest & Status */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar className="h-16 w-16 bg-red-50 border-2 border-red-50 p-1">
                                            <AvatarFallback className="bg-red-100 text-red-500 font-bold">
                                                {data.guestName.split(" ").map((n: string) => n[0]).join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-none">{data.guestName}</h2>
                                            {data.source === "Airbnb" && (
                                                <Badge className="bg-rose-100 text-rose-500 border-none px-1.5 py-0 text-[10px] font-bold uppercase tracking-tight">
                                                    ▲ ICAL IMPORT
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-slate-400" stroke="currentColor" strokeWidth="2">
                                                    <path d="M17 1l4 4-4 4m-12 5l-4-4 4-4m-1 7h16" />
                                                </svg>
                                                <span>Reserva Externa</span>
                                            </div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                            <span className="text-slate-500 text-sm font-medium">Plataforma {data.source}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1">
                                    <Badge className={cn(
                                        "px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-1",
                                        data.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-amber-50 text-amber-500 border-amber-100"
                                    )}>
                                        {data.status === "CONFIRMED" ? "CONFIRMADA" : "PENDIENTE"}
                                    </Badge>
                                    <span className="text-slate-400 text-xs font-medium">ID: {data.externalId}</span>
                                </div>
                            </div>

                            {/* Details Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 pt-6 sm:pt-8 border-t border-slate-100">
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 shrink-0">
                                        <Home size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Propiedad</span>
                                        <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">{data.propertyName}</h3>
                                        <span className="text-sm text-slate-500">{data.unitName}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary shrink-0">
                                        <Calendar size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estancia</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base sm:text-lg font-bold text-slate-800 leading-snug">{format(data.checkIn, "d MMM", { locale: es })}</span>
                                            <ChevronRight size={14} className="text-slate-300 mt-0.5" />
                                            <span className="text-base sm:text-lg font-bold text-slate-800 leading-snug">{format(data.checkOut, "d MMM", { locale: es })}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                                            <span>{format(data.checkIn, "HH:mm")}</span>
                                            <span>{format(data.checkOut, "HH:mm")}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary shrink-0">
                                        <Users size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Huéspedes</span>
                                        <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">{data.totalGuests}</h3>
                                        <span className="text-sm text-slate-500 font-medium">
                                            {data.totalGuests === 1 ? "huésped en total" : "huéspedes en total"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary shrink-0">
                                        <CreditCard size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</span>
                                        <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">${data.totalPrice.toLocaleString("es-CO")} {data.currency}</h3>
                                        <span className="text-sm text-slate-500 font-medium">Pagado • Stripe</span>
                                    </div>
                                </div>
                            </div>

                            {/* Automation Section — live status + manual redispatch */}
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <AutomationStatusList reservationUuid={data.uuid} totalGuests={data.totalGuests} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Guest Documents */}
                    <GuestDocumentsCard reservationUuid={data.uuid} />

                    {/* Property Documents */}
                    <PropertyDocumentsCard reservationUuid={data.uuid} />

                    {/* Activity Log */}
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-xl font-bold text-slate-800">Bitácora de Actividad</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4">
                                <div className="p-2 rounded-full h-fit bg-primary/10 text-primary">
                                    <FileText size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-bold text-slate-800">Reserva creada</span>
                                    <span className="text-xs text-slate-400 font-medium tracking-tight">
                                        {data.source} • ID: {data.externalId || data.uuid.slice(0, 8)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Areas */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Quick Actions */}
                    <Card className="bg-primary text-white border-none shadow-lg">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-primary/50">Acciones Rápidas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Dialog open={sendDialogOpen} onOpenChange={openSendDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-none justify-between h-12 px-5 group">
                                        <div className="flex items-center gap-3">
                                            <Send size={18} className="text-primary/50 group-hover:text-white transition-colors" />
                                            <span className="font-semibold">Enviar Link de Check-in</span>
                                        </div>
                                        <ChevronRight size={16} className="text-white/40" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[440px]">
                                    <DialogHeader>
                                        <DialogTitle>Enviar link de check-in</DialogTitle>
                                        <DialogDescription>
                                            Se enviará al correo indicado. Por defecto, el del huésped principal.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="checkin-link-email">Correo del huésped</Label>
                                            <Input
                                                id="checkin-link-email"
                                                type="email"
                                                value={recipientEmail}
                                                onChange={(e) => setRecipientEmail(e.target.value)}
                                                placeholder="huesped@correo.com"
                                            />
                                            {recipientEmail.trim() !== "" && !isValidEmail && (
                                                <p className="text-xs text-destructive">Ingresa un correo válido.</p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="checkin-link-locale">Idioma del correo</Label>
                                            <Select value={localeChoice} onValueChange={(v) => setLocaleChoice(v as "default" | CommunicationLocale)}>
                                                <SelectTrigger id="checkin-link-locale">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="default">
                                                        Idioma de la propiedad{data.communicationsLocale ? ` · ${LOCALE_LABELS[data.communicationsLocale]}` : ""}
                                                    </SelectItem>
                                                    {COMMUNICATION_LOCALES.map((loc) => (
                                                        <SelectItem key={loc} value={loc}>{LOCALE_LABELS[loc]}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={isSendingLink}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleSendCheckinLink}
                                            disabled={isSendingLink || !isValidEmail}
                                            className="bg-primary hover:bg-primary text-white"
                                        >
                                            {isSendingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {isSendingLink ? "Enviando..." : "Enviar"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button onClick={handleCopyCheckinLink} variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-none justify-between h-12 px-5 group">
                                <div className="flex items-center gap-3">
                                    <Copy size={18} className="text-primary/50 group-hover:text-white transition-colors" />
                                    <span className="font-semibold">Copiar Link de Check-in</span>
                                </div>
                                <ChevronRight size={16} className="text-white/40" />
                            </Button>
                            <Button onClick={handleMessageGuest} disabled={!data.email} variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-none justify-between h-12 px-5 group disabled:opacity-50">
                                <div className="flex items-center gap-3">
                                    <MessageSquare size={18} className="text-primary/50 group-hover:text-white transition-colors" />
                                    <span className="font-semibold">Mensaje al Huésped</span>
                                </div>
                                <ChevronRight size={16} className="text-white/40" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Price Breakdown */}
                    <Card className="bg-primary text-white border-none shadow-lg overflow-hidden relative">
                        {/* Background subtle gradient/shape */}
                        <div className="absolute top-0 right-0 p-6 opacity-20 transform translate-x-4 -translate-y-4">
                            <CreditCard size={120} />
                        </div>

                        <CardContent className="p-6">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/50">Total Reserva</span>
                            <div className="flex items-center justify-between mt-1 mb-6">
                                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">${data.totalPrice.toLocaleString("es-CO")} {data.currency}</h3>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <CreditCard size={20} />
                                </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-white/20">
                                <div className="flex items-center justify-between text-sm font-medium">
                                    <span className="text-primary/30">Total</span>
                                    <span>${data.totalPrice.toLocaleString("es-CO")} {data.currency}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <Badge className="bg-white/20 hover:bg-white/20 text-white border-none px-3 py-1 text-xs">Pagado</Badge>
                                <Badge className="bg-white/20 hover:bg-white/20 text-white border-none px-3 py-1 text-xs">{data.source === "Airbnb" ? "Stripe" : "Manual"}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
