"use client"

import Link from "next/link"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { CheckCircle2, MapPin, CalendarDays, Home } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { completedEntryCopy, resolveCompletedEntryReason } from "@/features/checkin/lib/success-entry"

interface SecondarySuccessScreenProps {
    portal: CheckinPortalResponse
    reservationUuid: string
}

export function SecondarySuccessScreen({ portal, reservationUuid }: SecondarySuccessScreenProps) {
    const res = portal.reservation;
    const searchParams = useSearchParams()
    const completedEntryReason = resolveCompletedEntryReason(
        searchParams.get("entry"),
        searchParams.get("guest_uuid"),
        portal.registeredGuests,
    )
    const completedCopy = completedEntryReason ? completedEntryCopy(completedEntryReason) : null

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={3} totalSteps={3} isSuccess />

            <div className="flex flex-col items-center justify-center text-center mt-6 space-y-4">
                <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    {completedCopy?.title ?? "¡Registro Exitoso!"}
                </h1>
                <p className="text-slate-500 text-sm max-w-sm">
                    {completedCopy?.description ?? "Tus datos han sido registrados correctamente."}
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Resumen de Estadía</h3>
                
                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-brand-purple shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Tu alojamiento</p>
                        <p className="text-xs text-slate-500">{res.uuid.slice(0, 8)}...</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <CalendarDays className="h-5 w-5 text-brand-purple shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-slate-900">
                            {res.arrivalDate} — {res.departureDate}
                        </p>
                        <p className="text-xs text-slate-500">{res.totalGuestsAllowed} huéspedes permitidos</p>
                    </div>
                </div>
            </div>

            <div className="bg-brand-navy/5 border border-brand-navy/10 rounded-2xl p-5 text-center">
                <p className="text-sm text-brand-navy font-medium">
                    El huésped titular tiene acceso a las instrucciones de llegada y códigos de cerradura.
                </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <Link
                        href={`/checkin/${reservationUuid}`}
                        className="w-full flex items-center justify-center gap-2 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-base shadow-lg transition-all active:scale-[0.98]"
                    >
                        <Home size={18} />
                        Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    )
}
