"use client"

import React from "react"
import { detailedMockReservations, AutomationStatus as AutomationStatusType } from "../data/detailed-mock-data"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    Printer,
    Edit,
    ChevronRight,
    Send,
    Key,
    MessageSquare,
    CreditCard,
    Calendar,
    Home,
    Clock,
    MapPin,
    Smartphone,
    CheckCircle2,
    FileText,
    Settings,
    Shield,
    XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AutomationTileProps {
    icon: React.ElementType
    label: string
    status: string
    variant?: "success" | "pending" | "none"
}

const AutomationTile = ({ icon: Icon, label, status, variant = "none" }: AutomationTileProps) => {
    const variants = {
        success: "bg-emerald-50 text-emerald-600 border-emerald-100",
        pending: "bg-slate-50 text-slate-400 border-slate-100",
        none: "bg-slate-50 text-slate-300 border-slate-100"
    }

    const iconBg = {
        success: "bg-emerald-500 text-white",
        pending: "bg-slate-300 text-white",
        none: "bg-slate-200 text-white"
    }

    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all h-24 w-full",
            variants[variant]
        )}>
            <div className={cn("p-1.5 rounded-full mb-2", iconBg[variant])}>
                <Icon size={16} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">{label}</span>
            <span className="text-[11px] font-semibold">{status}</span>
        </div>
    )
}

import Link from "next/link"

export function OperationsPanel({ reservationId }: { reservationId: string }) {
    // Determine data based on ID, fallback to default or Maria's data for demo
    const data = detailedMockReservations[reservationId] || detailedMockReservations["RES-MG-001"];

    const automationStatuses: { label: string; icon: any; statusKey: keyof AutomationStatusType }[] = [
        { label: "Link", icon: Send, statusKey: "link" },
        { label: "Check-in", icon: CheckCircle2, statusKey: "checkin" },
        { label: "Contrato", icon: Smartphone, statusKey: "contract" },
        { label: "Código", icon: Key, statusKey: "code" },
        { label: "TRA", icon: Shield, statusKey: "tra" },
        { label: "SIRE", icon: XCircle, statusKey: "sire" },
    ]

    const getStatusText = (status: "success" | "pending" | "none", label: string) => {
        if (status === "success") {
            if (label === "Link") return "Enviado"
            if (label === "Check-in") return "Completado"
            if (label === "Contrato") return "Enviado"
            return "Completado"
        }
        if (status === "pending") return "Programado"
        return "N/A"
    }

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            {/* Breadcrumbs & Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center text-xs font-medium text-slate-500 gap-1.5">
                        <Link href="/dashboard/reservations" className="hover:text-indigo-600 transition-colors">
                            Operaciones
                        </Link>
                        <ChevronRight size={12} className="text-slate-400" />
                        <span className="text-indigo-600 font-semibold">Reserva {reservationId}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel de Operaciones</h1>
                    <p className="text-sm text-slate-500">Gestión detallada de la reserva y automatizaciones</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="bg-white border-slate-200 text-slate-700 shadow-sm gap-2">
                        <Printer size={16} />
                        Imprimir
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2">
                        <Edit size={16} />
                        Editar Reserva
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Guest & Reservation Info Card */}
                    <Card className="border-fuchsia-200 border-2 overflow-hidden shadow-sm">
                        <CardContent className="p-6">
                            {/* Top row: Guest & Status */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar className="h-16 w-16 bg-red-50 border-2 border-red-50 p-1">
                                            <AvatarImage src="/images/guest-placeholder.png" alt={data.guestName} />
                                            <AvatarFallback className="bg-red-100 text-red-500 font-bold">
                                                {data.guestName.split(" ").map(n => n[0]).join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-2xl font-bold text-slate-900 leading-none">{data.guestName}</h2>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-100">
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 shrink-0">
                                        <Home size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Propiedad</span>
                                        <h3 className="text-lg font-bold text-slate-800 leading-snug">{data.propertyName}</h3>
                                        <span className="text-sm text-slate-500">{data.unitName}</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-indigo-500 shrink-0">
                                        <Calendar size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estancia</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-slate-800 leading-snug">{format(data.checkIn, "d MMM", { locale: es })}</span>
                                            <ChevronRight size={14} className="text-slate-300 mt-0.5" />
                                            <span className="text-lg font-bold text-slate-800 leading-snug">{format(data.checkOut, "d MMM", { locale: es })}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                                            <span>{format(data.checkIn, "HH:mm")}</span>
                                            <span>{format(data.checkOut, "HH:mm")}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-indigo-500 shrink-0">
                                        <CreditCard size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</span>
                                        <h3 className="text-lg font-bold text-slate-800 leading-snug">${data.totalPrice.toLocaleString("es-CO")} COP</h3>
                                        <span className="text-sm text-slate-500 font-medium">Pagado • Stripe</span>
                                    </div>
                                </div>
                            </div>

                            {/* Automation Section */}
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Estado de Automatización</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                    {automationStatuses.map((autom) => (
                                        <AutomationTile
                                            key={autom.label}
                                            icon={autom.icon}
                                            label={autom.label}
                                            status={getStatusText(data.automationStatus[autom.statusKey], autom.label)}
                                            variant={data.automationStatus[autom.statusKey]}
                                        />
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity Log */}
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-xl font-bold text-slate-800">Bitácora de Actividad</CardTitle>
                            <Button variant="link" className="text-indigo-600 font-semibold p-0">Ver todo</Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {data.activityLog.map((event) => (
                                <div key={event.id} className="flex gap-4">
                                    <div className={cn(
                                        "p-2 rounded-full h-fit",
                                        event.type === "success" ? "bg-emerald-100 text-emerald-600" :
                                            event.type === "info" ? "bg-indigo-100 text-indigo-600" : "bg-fuchsia-100 text-fuchsia-600"
                                    )}>
                                        {event.type === "success" ? <CheckCircle2 size={20} /> :
                                            event.type === "info" ? <Send size={20} /> : <FileText size={20} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-base font-bold text-slate-800">{event.title}</span>
                                        <span className="text-xs text-slate-400 font-medium tracking-tight">
                                            {event.timestamp} • {event.source}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Areas */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Quick Actions */}
                    <Card className="bg-indigo-900 text-white border-none shadow-lg">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Acciones Rápidas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-none justify-between h-12 px-5 group">
                                <div className="flex items-center gap-3">
                                    <Send size={18} className="text-indigo-300 group-hover:text-white transition-colors" />
                                    <span className="font-semibold">Reenviar Link</span>
                                </div>
                                <ChevronRight size={16} className="text-white/40" />
                            </Button>
                            <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-none justify-between h-12 px-5 group">
                                <div className="flex items-center gap-3">
                                    <Key size={18} className="text-indigo-300 group-hover:text-white transition-colors" />
                                    <span className="font-semibold">Generar Código Manual</span>
                                </div>
                                <ChevronRight size={16} className="text-white/40" />
                            </Button>
                            <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-none justify-between h-12 px-5 group">
                                <div className="flex items-center gap-3">
                                    <MessageSquare size={18} className="text-indigo-300 group-hover:text-white transition-colors" />
                                    <span className="font-semibold">Mensaje al Huésped</span>
                                </div>
                                <ChevronRight size={16} className="text-white/40" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Price Breakdown */}
                    <Card className="bg-indigo-600 text-white border-none shadow-lg overflow-hidden relative">
                        {/* Background subtle gradient/shape */}
                        <div className="absolute top-0 right-0 p-6 opacity-20 transform translate-x-4 -translate-y-4">
                            <CreditCard size={120} />
                        </div>

                        <CardContent className="p-6">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Total Reserva</span>
                            <div className="flex items-center justify-between mt-1 mb-6">
                                <h3 className="text-3xl font-bold tracking-tight">${data.totalPrice.toLocaleString("es-CO")} COP</h3>
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <CreditCard size={20} />
                                </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-white/20">
                                <div className="flex items-center justify-between text-sm font-medium">
                                    <span className="text-indigo-100">Alojamiento</span>
                                    <span>${data.breakdown.alojamiento.toLocaleString("es-CO")} COP</span>
                                </div>
                                <div className="flex items-center justify-between text-sm font-medium">
                                    <span className="text-indigo-100">Limpieza</span>
                                    <span>${data.breakdown.limpieza.toLocaleString("es-CO")} COP</span>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-6">
                                <Badge className="bg-white/20 hover:bg-white/20 text-white border-none px-3 py-1 text-xs">Pagado</Badge>
                                <Badge className="bg-white/20 hover:bg-white/20 text-white border-none px-3 py-1 text-xs">{data.source === "Airbnb" ? "Stripe" : "Manual"}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Map View */}
                    <Card className="p-0 overflow-hidden shadow-sm border-none bg-slate-100 h-64 relative group">
                        {/* Map placeholder */}
                        <div
                            className="absolute inset-0 bg-cover bg-center grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                            style={{ backgroundImage: "url('/images/map-placeholder.png')" }}
                        >
                            {/* SVG mockup of a map grid */}
                            <div className="w-full h-full opacity-20 pointer-events-none">
                                <svg width="100%" height="100%">
                                    <defs>
                                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                                        </pattern>
                                    </defs>
                                    <rect width="100%" height="100%" fill="url(#grid)" />
                                </svg>
                            </div>
                        </div>

                        <div className="absolute inset-0 flex items-end justify-start p-4 bg-gradient-to-t from-black/40 to-transparent">
                            <Button className="bg-white text-slate-900 hover:bg-white/90 shadow-lg rounded-full px-6 gap-2">
                                <MapPin size={16} className="text-indigo-600" />
                                <span className="font-bold text-sm">Ver en Mapa</span>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
