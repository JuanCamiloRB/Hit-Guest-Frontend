"use client"

import Link from "next/link"
import { CheckCircle2, Home, Users, Calendar, MapPin, Download, Clock } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { SmartlockCodes } from "@/features/checkin/components/SmartlockCodes"
import { mockSmartlockCodes } from "@/features/checkin/data/mock-guest-data"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"

interface SuccessScreenProps {
    portal: CheckinPortalResponse
    reservationUuid: string
}

export function SuccessScreen({ portal, reservationUuid }: SuccessScreenProps) {
    const res = portal.reservation;
    const searchParams = useSearchParams()
    const isMainDone = searchParams.get("main_done") === "true"
    const pendingGuests = Number(searchParams.get("pending") ?? "0")
    const hasPendingSecondaries = isMainDone && pendingGuests > 0
    const welcomeHref = `/checkin/${reservationUuid}`

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + "T12:00:00")
        return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 animate-in zoom-in-95 duration-700 pb-24 text-center px-4">
            <ProgressBar currentStep={5} totalSteps={5} isSuccess />

            <div className="relative mt-4">
                <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 rounded-full" />
                <div className="bg-gradient-to-tr from-green-400 to-green-500 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 relative z-10">
                    <CheckCircle2 size={48} className="text-white" />
                </div>
            </div>

            <div className="space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    {isMainDone ? "¡Tu Registro Está Listo!" : "¡Check-in Completado!"}
                </h1>
                <p className="text-slate-500 text-base max-w-[300px] mx-auto">
                    {isMainDone
                        ? "Los huéspedes acompañantes ya pueden iniciar su registro."
                        : "Tus datos y documentos han sido validados exitosamente. Ya estás un paso más cerca de tu estadía."}
                </p>
            </div>

            {isMainDone && pendingGuests > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Clock size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">
                            {pendingGuests} {pendingGuests === 1 ? "huésped pendiente" : "huéspedes pendientes"}
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            Los accesos de la propiedad estarán disponibles cuando todos completen su registro.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-100 rounded-2xl p-4 w-full max-w-sm space-y-3 shadow-sm">
                <div className="flex items-center gap-3 text-left">
                    <div className="bg-brand-purple/10 p-2 rounded-xl">
                        <MapPin size={18} className="text-brand-purple" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Tu alojamiento</h3>
                        <p className="text-xs text-slate-500">{res.uuid.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-600">{formatDate(res.arrivalDate)} — {formatDate(res.departureDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-600">{res.totalGuestsAllowed} huéspedes</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4 text-left w-full max-w-sm">
                <div className="bg-brand-purple/10 p-3 rounded-xl">
                    <Download className="text-brand-purple" size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-sm">Contrato Firmado</h3>
                    <p className="text-xs text-slate-500">Puedes descargar tu copia aquí.</p>
                </div>
                <button className="text-sm font-bold text-brand-purple hover:underline">
                    Descargar
                </button>
            </div>

            {!isMainDone && <SmartlockCodes codes={mockSmartlockCodes()} />}

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4 text-left w-full max-w-sm mt-2">
                <div className="bg-brand-purple/10 p-3 rounded-xl flex-shrink-0">
                    <Home className="text-brand-purple" size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Todo Listo</h3>
                    <p className="text-xs text-slate-500">Recibirás también esta información por email antes de tu llegada.</p>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg flex flex-col gap-2">
                    {hasPendingSecondaries && (
                        <Link href={welcomeHref} className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-base shadow-lg transition-all active:scale-[0.98]">
                            <Users size={18} />
                            Ver inicio para acompañantes
                        </Link>
                    )}
                    <Link
                        href={hasPendingSecondaries ? welcomeHref : "/"}
                        className="w-full flex items-center justify-center gap-2 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-base shadow-lg transition-all active:scale-[0.98]"
                    >
                        {hasPendingSecondaries ? "Cerrar y volver al inicio" : "Cerrar"}
                    </Link>
                </div>
            </div>
        </div>
    )
}
