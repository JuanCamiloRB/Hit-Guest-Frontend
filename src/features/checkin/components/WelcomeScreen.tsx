"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Clock, CreditCard, IdCard, Key, ShieldCheck, Calendar, Users, CheckCircle2, Circle, Lock, UserCircle } from "lucide-react"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { isMainGuestCompleted } from "@/features/checkin/types/checkin"

interface WelcomeScreenProps {
    portal: CheckinPortalResponse
    basePath: string
}

export function WelcomeScreen({ portal, basePath }: WelcomeScreenProps) {
    const { reservation: res, progress, registeredGuests } = portal
    const reservationUuid = basePath.replace(/^\/checkin\//, '').split('/')[0]
    const searchParams = useSearchParams()
    const [doneGuestUuids, setDoneGuestUuids] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (searchParams.get('error') === 'max_guests') {
            toast.error('La reserva ya tiene todos sus huéspedes registrados')
        }
    }, [searchParams])

    useEffect(() => {
        const done = new Set<string>()
        registeredGuests.forEach(g => {
            const key = g.isMain
                ? `checkin-main-done-${reservationUuid}`
                : `checkin-secondary-done-${reservationUuid}-${g.uuid}`
            if (localStorage.getItem(key) === 'true') done.add(g.uuid)
        })
        setDoneGuestUuids(done)
    }, [reservationUuid]) // eslint-disable-line react-hooks/exhaustive-deps

    const mainGuest = registeredGuests.find(g => g.isMain)
    const mainGuestUuid = mainGuest?.uuid ?? ''
    const mainCompleted = isMainGuestCompleted(portal) || doneGuestUuids.has(mainGuestUuid)

    const isGuestDone = (g: { uuid: string; isCompleted: boolean; isMain: boolean }) =>
        g.isCompleted || doneGuestUuids.has(g.uuid)

    const localCompleted = Math.max(
        progress.completed,
        registeredGuests.filter(g => isGuestDone(g)).length
    )

    const arrival = new Date(res.arrivalDate + "T12:00:00")
    const departure = new Date(res.departureDate + "T12:00:00")
    const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + "T12:00:00")
        return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
    }

    const isFullyCompleted = progress.isFullyCompleted || (res.totalGuestsAllowed > 0 && localCompleted >= res.totalGuestsAllowed)

    // ── Guest list logic ──────────────────────────────────────────────────────
    // registeredGuests: guests known to the backend (have name from PMS or /identify)
    // anonymousSlots: remaining slots that don't have a name yet
    const anonymousSlotsCount = Math.max(0, res.totalGuestsAllowed - registeredGuests.length)
    const knownNonMainGuests = registeredGuests.filter(g => !g.isMain)

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* NO StepIndicator here — eliminado para reducir fricción */}

            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                    Check-in Online
                </h1>
                <p className="text-slate-500 text-base">
                    Completa tu registro antes de la fecha de llegada.
                </p>
            </div>

            {/* Reservation Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Llegada</span>
                        <p className="font-medium mt-0.5 text-slate-800">{formatDate(res.arrivalDate)}</p>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Salida</span>
                        <p className="font-medium mt-0.5 text-slate-800">{formatDate(res.departureDate)}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100/50 flex items-center gap-2">
                        <Calendar size={16} className="text-brand-blue" />
                        <span className="text-sm font-medium text-slate-700">{nights} {nights === 1 ? "Noche" : "Noches"}</span>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100/50 flex items-center gap-2">
                        <Users size={16} className="text-brand-blue" />
                        <span className="text-sm font-medium text-slate-700">{res.totalGuestsAllowed} {res.totalGuestsAllowed === 1 ? "Huésped" : "Huéspedes"}</span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Progreso del registro</span>
                        <span className="font-bold text-brand-purple">
                            {localCompleted}/{res.totalGuestsAllowed} completados
                        </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-brand-purple transition-all duration-500"
                            style={{ width: `${res.totalGuestsAllowed > 0 ? (localCompleted / res.totalGuestsAllowed) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Guest list — known guests + anonymous slots */}
                <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Huéspedes de la reserva</p>

                    {/* Main guest (always shown with name if known from PMS) */}
                    {mainGuest ? (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                            <div className="flex items-center gap-2">
                                {isGuestDone(mainGuest)
                                    ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                                    : <Circle size={16} className="text-slate-300 flex-shrink-0" />
                                }
                                <span className="text-slate-700 font-medium text-sm">
                                    {`${mainGuest.name} ${mainGuest.lastname}`.trim() || "Titular de la reserva"}
                                </span>
                                <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/10 px-1.5 py-0.5 rounded-full">
                                    Principal
                                </span>
                            </div>
                            <div className="flex-shrink-0">
                                {isGuestDone(mainGuest) ? (
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                                        Completado
                                    </span>
                                ) : (
                                    <Link
                                        href={`${basePath}/identify`}
                                        className="text-xs font-semibold text-brand-purple bg-brand-purple/10 px-3 py-1.5 rounded-lg hover:bg-brand-purple/20 transition-colors"
                                    >
                                        Iniciar registro
                                    </Link>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* No main guest in registeredGuests yet — show CTA to start */
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                            <div className="flex items-center gap-2">
                                <Circle size={16} className="text-slate-300 flex-shrink-0" />
                                <span className="text-slate-700 font-medium text-sm">Titular de la reserva</span>
                                <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/10 px-1.5 py-0.5 rounded-full">Principal</span>
                            </div>
                            <Link
                                href={`${basePath}/identify`}
                                className="text-xs font-semibold text-brand-purple bg-brand-purple/10 px-3 py-1.5 rounded-lg hover:bg-brand-purple/20 transition-colors"
                            >
                                Iniciar registro
                            </Link>
                        </div>
                    )}

                    {/* Secondary guests that already completed /identify (have real names) */}
                    {knownNonMainGuests.map(g => (
                        <div key={g.uuid} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                            <div className="flex items-center gap-2">
                                {isGuestDone(g)
                                    ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                                    : <Circle size={16} className="text-slate-300 flex-shrink-0" />
                                }
                                <span className="text-slate-700 font-medium text-sm">
                                    {`${g.name} ${g.lastname}`.trim()}
                                </span>
                            </div>
                            <div className="flex-shrink-0">
                                {isGuestDone(g) ? (
                                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                                        Completado
                                    </span>
                                ) : mainCompleted ? (
                                    <Link
                                        href={`${basePath}/s/${g.uuid}/identify`}
                                        className="text-xs font-semibold text-brand-blue bg-brand-blue/10 px-3 py-1.5 rounded-lg hover:bg-brand-blue/20 transition-colors"
                                    >
                                        Iniciar registro
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">
                                        <Lock size={12} />
                                        <span>Esperando al titular</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Anonymous slots — guests we don't know yet */}
                    {Array.from({ length: anonymousSlotsCount }, (_, i) => {
                        const slotNumber = registeredGuests.length + i + 1
                        return (
                            <div key={`anon-${i}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                                <div className="flex items-center gap-2">
                                    <UserCircle size={16} className="text-slate-300 flex-shrink-0" />
                                    <span className="text-slate-400 font-medium text-sm italic">
                                        Huésped {slotNumber}
                                    </span>
                                </div>
                                <div className="flex-shrink-0">
                                    {mainCompleted ? (
                                        <Link
                                            href={`${basePath}/s/new-${slotNumber}/identify`}
                                            className="text-xs font-semibold text-brand-blue bg-brand-blue/10 px-3 py-1.5 rounded-lg hover:bg-brand-blue/20 transition-colors"
                                        >
                                            Iniciar registro
                                        </Link>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                                            <Lock size={12} />
                                            <span>Esperando al titular</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Info Box */}
            {!isFullyCompleted && (
                <div className="bg-brand-blue/5 rounded-2xl p-5 border border-brand-blue/10">
                    <div className="flex items-center gap-3 mb-4 text-brand-blue">
                        <Clock size={20} />
                        <span className="font-semibold">Tomará aproximadamente 3 minutos</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4 font-medium">Requisitos para completar el registro:</p>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 text-brand-purple">
                                <IdCard size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Documento de identidad</p>
                                <p className="text-xs text-slate-500 mt-0.5">Pasaporte o cédula original de todos los adultos.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 text-brand-purple">
                                <CreditCard size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Datos de contacto</p>
                                <p className="text-xs text-slate-500 mt-0.5">Teléfono, email y datos de viaje del titular.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            )}

            {/* Security */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center text-center bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <ShieldCheck size={28} className="text-green-500 mb-2" />
                    <span className="text-xs font-semibold text-slate-800">Cifrado Seguro</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Datos protegidos</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Key size={28} className="text-amber-500 mb-2" />
                    <span className="text-xs font-semibold text-slate-800">Acceso Rápido</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Evita la recepción</span>
                </div>
            </div>

            {/* Global CTA */}
            {isFullyCompleted && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                    <div className="w-full max-w-lg">
                        <Link
                            href={`${basePath}/success`}
                            className="w-full flex items-center justify-center h-14 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                        >
                            Ver Resumen de Check-in
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
