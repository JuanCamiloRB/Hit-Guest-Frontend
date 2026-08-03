"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Clock, CreditCard, IdCard, Key, ShieldCheck, Calendar, Users, CheckCircle2, Circle, Lock, UserCircle, ArrowRight, Share2 } from "lucide-react"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { isMainGuestCompleted } from "@/features/checkin/types/checkin"

interface WelcomeScreenProps {
    portal: CheckinPortalResponse
    basePath: string
}

export function WelcomeScreen({ portal, basePath }: WelcomeScreenProps) {
    const { reservation: res, progress, registeredGuests } = portal
    const searchParams = useSearchParams()
    useEffect(() => {
        if (searchParams.get('error') === 'max_guests') {
            toast.error('La reserva ya tiene todos sus huéspedes registrados')
        }
    }, [searchParams])

    const mainGuest = registeredGuests.find(g => g.isMain)
    const mainCompleted = isMainGuestCompleted(portal)

    // Returns the correct "continue" URL for a known guest based on their verification state,
    // avoiding unnecessary roundtrips through /identify when the step is already known.
    const getContinueLink = (guest: typeof registeredGuests[0]) => {
        const step = guest.verification?.currentStep
        if (step === "verification") return `${basePath}/verify?guest_uuid=${guest.uuid}`
        if (step === "form")         return `${basePath}/guest?guest_uuid=${guest.uuid}`
        return `${basePath}/identify?guest_uuid=${guest.uuid}`
    }

    // Completion is server-owned. localStorage is navigation cache only and must
    // never turn a pending guest into a completed one.
    const isGuestDone = (g: { isCompleted: boolean }) => g.isCompleted

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

    // Single most important next action, surfaced as a big fixed CTA so guests on
    // autopilot can't miss it (the inline row links are easy to overlook). The main
    // guest is the priority; once done, it points at the next pending secondary.
    let primaryCtaHref: string | null = null
    let primaryCtaLabel = ""
    if (!isFullyCompleted) {
        if (!mainCompleted) {
            primaryCtaHref = mainGuest ? getContinueLink(mainGuest) : `${basePath}/identify`
            primaryCtaLabel = mainGuest ? "Continuar mi registro" : "Comenzar mi registro"
        } else {
            const nextKnown = knownNonMainGuests.find(g => !isGuestDone(g))
            if (nextKnown) {
                primaryCtaHref = getContinueLink(nextKnown)
                primaryCtaLabel = "Registrar siguiente huésped"
            } else if (anonymousSlotsCount > 0) {
                primaryCtaHref = `${basePath}/s/new-${registeredGuests.length + 1}/identify`
                primaryCtaLabel = "Registrar siguiente huésped"
            }
        }
    }

    // Companions the main guest can invite by re-sending the reservation link.
    const hasPendingCompanions =
        mainCompleted
        && (anonymousSlotsCount > 0 || knownNonMainGuests.some(g => !isGuestDone(g)))

    const getShareUrl = () =>
        typeof window === "undefined"
            ? ""
            : new URL(basePath, window.location.origin).toString()

    // Re-send the check-in link to companions. Native share (or WhatsApp) lets the
    // guest pick a contact directly — the ask. Clipboard is the fallback.
    const handleShareLink = async () => {
        const url = getShareUrl()
        const message = `Hola, completa tu registro de check-in para nuestra reserva aquí: ${url}`
        try {
            if (navigator.share) {
                await navigator.share({ title: "Registro de check-in", text: message, url })
                return
            }
        } catch (error) {
            // Cancelling the native sheet is intentional; do not unexpectedly open WhatsApp.
            if (error instanceof DOMException && error.name === "AbortError") return
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer")
    }

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(getShareUrl())
            toast.success("Link copiado", { description: "Compártelo con tus acompañantes." })
        } catch {
            toast.error("No se pudo copiar el link")
        }
    }

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
                                        href={getContinueLink(mainGuest)}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-white bg-brand-purple px-3.5 py-2 rounded-lg hover:bg-brand-purple/90 transition-colors active:scale-[0.98]"
                                    >
                                        Continuar registro <ArrowRight size={13} />
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
                                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-brand-purple px-3.5 py-2 rounded-lg hover:bg-brand-purple/90 transition-colors active:scale-[0.98]"
                            >
                                Iniciar registro <ArrowRight size={13} />
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
                                        href={getContinueLink(g)}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-white bg-brand-blue px-3.5 py-2 rounded-lg hover:bg-brand-blue/90 transition-colors active:scale-[0.98]"
                                    >
                                        Iniciar registro <ArrowRight size={13} />
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

                    {/* Re-send the link so companions can register themselves. */}
                    {hasPendingCompanions && (
                        <div className="mt-3 rounded-xl border border-brand-purple/15 bg-brand-purple/5 p-3">
                            <p className="text-xs font-medium text-slate-600 mb-2">
                                ¿Viajas acompañado? Envíales el link para que hagan su registro.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleShareLink}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-brand-purple text-white text-sm font-bold hover:bg-brand-purple/90 transition-colors active:scale-[0.98]"
                                >
                                    <Share2 size={15} />
                                    Compartir link
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="inline-flex items-center justify-center h-10 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                                >
                                    Copiar
                                </button>
                            </div>
                        </div>
                    )}
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

            {/* Global CTA — big, unmissable primary action fixed at the bottom. */}
            {isFullyCompleted ? (
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
            ) : primaryCtaHref ? (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                    <div className="w-full max-w-lg">
                        <Link
                            href={primaryCtaHref}
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/25 transition-all active:scale-[0.98]"
                        >
                            {primaryCtaLabel}
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
