"use client"

import { useEffect, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Clock, CreditCard, IdCard, Key, ShieldCheck, Calendar, Users, CheckCircle2, Circle, Lock, UserCircle, ArrowRight, Share2 } from "lucide-react"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { isMainGuestCompleted } from "@/features/checkin/types/checkin"
import { AccessInstructionsPanel } from "./AccessInstructionsPanel"

interface WelcomeScreenProps {
    portal: CheckinPortalResponse
    basePath: string
}

// Shared badge tokens so every guest row reads the same way. All of them share
// the same size/shape — only the color changes — so "Principal" next to
// "Pendiente" doesn't look like two different design systems.
const BADGE_BASE = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-5"
const BADGE_MAIN = `${BADGE_BASE} bg-brand-purple/10 text-brand-purple`
const BADGE_DONE = `${BADGE_BASE} bg-green-50 text-green-600`
const BADGE_PENDING = `${BADGE_BASE} bg-slate-100 text-slate-500`
const BADGE_LOCKED = `${BADGE_BASE} bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100`
const BADGE_LOCKED_MUTED = `${BADGE_BASE} bg-slate-100 font-medium text-slate-400`

/**
 * Fixed bottom action bar.
 *
 * The inner wrapper mirrors the checkin layout's `<main>` (`max-w-lg` + `px-4`)
 * EXACTLY — padding on the inner element, not the outer one. With the padding
 * outside, the bar's content box is 512px while the cards above are 480px, so
 * on any viewport ≥ 544px the button visibly overhangs the column by 16px a side.
 *
 * No `env(safe-area-inset-bottom)`: this app never sets `viewport-fit=cover`
 * (Next's default viewport meta is `width=device-width, initial-scale=1`), so
 * `env()` resolves to 0 and iOS already insets the layout viewport above the
 * home indicator. Adding it back only makes sense together with the viewport
 * meta AND the same padding on the other 11 checkin bottom bars.
 */
const BOTTOM_BAR = "fixed bottom-0 left-0 right-0 z-10 flex justify-center border-t border-slate-200/70 bg-white/95 py-4 backdrop-blur-md"
const BOTTOM_BAR_INNER = "w-full max-w-lg px-4"

/**
 * Guest list row.
 *
 * Stacked on purpose: at 375px the row only has ~279px of usable width, so a
 * side-by-side name + badge + action layout forces the name to either wrap
 * word-by-word or be truncated. Long real names (e.g. "Didier Alain Pascal
 * Edmond Van Den Hove") must stay readable, so the name owns the full column
 * width and badges/actions stack underneath it.
 *
 * Name, badges and actions all live in the SAME flex column, so they align with
 * each other by construction — no hardcoded indent that silently breaks if the
 * icon size ever changes.
 */
function GuestRow({
    icon,
    name,
    nameClassName = "text-slate-700",
    badges,
    actions,
}: {
    icon: ReactNode
    name: string
    nameClassName?: string
    badges?: ReactNode
    actions?: ReactNode
}) {
    return (
        <li className="flex items-start gap-2.5 rounded-xl border border-slate-100/50 bg-slate-50 p-3">
            <span className="mt-0.5 flex-shrink-0">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className={`break-words text-sm font-medium leading-snug ${nameClassName}`}>
                    {name}
                </p>
                {badges && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges}</div>
                )}
                {actions && (
                    <div className="mt-2.5 flex items-center gap-1.5">{actions}</div>
                )}
            </div>
        </li>
    )
}

/**
 * The register + share pair shown on a pending companion row. Identical for a
 * known guest and for an anonymous slot — only the destination and the emphasis
 * differ (a named guest is the stronger call, so it gets the solid button).
 */
function GuestRowActions({
    href,
    shareLabel,
    onShare,
    emphasis,
}: {
    href: string
    shareLabel: string
    onShare: () => void
    emphasis: "solid" | "soft"
}) {
    return (
        <>
            <Link
                href={href}
                className={`inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-bold transition-colors active:scale-[0.98] ${
                    emphasis === "solid"
                        ? "bg-brand-blue text-white hover:bg-brand-blue/90"
                        : "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
                }`}
            >
                Registrar <ArrowRight size={13} />
            </Link>
            <button
                type="button"
                onClick={onShare}
                aria-label={shareLabel}
                title={shareLabel}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-brand-purple/15 bg-white text-brand-purple transition-colors hover:bg-brand-purple/5"
            >
                <Share2 size={14} />
            </button>
        </>
    )
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
    /**
     * Una reserva cerrada (status 30) devuelve el portal COMPLETO —documentos y
     * códigos de acceso incluidos— pero con `checkinAllowed: false`, y el backend
     * rechaza con 422 todo lo que escriba: /identify, /form, /main/complete,
     * /secondary/complete, /main/sign y /contract/preview.
     *
     * Este campo no se leía en ninguna parte, así que la pantalla seguía
     * ofreciendo "Registrar siguiente huésped" y los links para compartir, y el
     * huésped chocaba contra un 422 crudo. Se ocultan solo las ACCIONES: el
     * portal se sigue viendo, porque quien ya completó necesita sus documentos y
     * sus códigos.
     *
     * `undefined` cuenta como abierto: los backends viejos no mandan el campo.
     */
    const checkinOpen = res.checkinAllowed !== false

    let primaryCtaHref: string | null = null
    let primaryCtaLabel = ""
    if (!isFullyCompleted && checkinOpen) {
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
        && checkinOpen
        && (anonymousSlotsCount > 0 || knownNonMainGuests.some(g => !isGuestDone(g)))

    const getShareUrl = () =>
        typeof window === "undefined"
            ? ""
            : new URL(basePath, window.location.origin).toString()

    // Re-send the check-in link to companions. Native share (or WhatsApp) lets the
    // guest pick a contact directly — the ask. Clipboard is the fallback.
    const handleShareLink = async (guestName?: string) => {
        const url = getShareUrl()
        const greeting = guestName ? `Hola ${guestName},` : "Hola,"
        const message = `${greeting} completa tu registro de check-in para nuestra reserva aquí: ${url}`
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

    const handleCopyLink = async (guestName?: string) => {
        try {
            await navigator.clipboard.writeText(getShareUrl())
            toast.success("Link copiado", {
                description: guestName ? `Listo para enviárselo a ${guestName}.` : "Compártelo con tus acompañantes.",
            })
        } catch {
            toast.error("No se pudo copiar el link")
        }
    }

    // The fixed bar is ~89px tall (py-4 + h-14 + border). Only reserve room for it
    // when it actually renders, so a screen without a CTA has no dead scroll.
    const showBottomBar = isFullyCompleted || primaryCtaHref !== null

    return (
        <div className={`flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${showBottomBar ? "pb-28" : ""}`}>
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

                {/* El registro está cerrado para esta reserva: se explica una vez,
                    en vez de dejar que el huésped lo descubra chocando con un 422
                    después de llenar el formulario. */}
                {!checkinOpen && (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <Lock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 leading-relaxed">
                            El registro en línea está cerrado para esta reserva. Puedes seguir
                            consultando tus documentos, pero si necesitas modificar algo
                            contacta al anfitrión.
                        </p>
                    </div>
                )}

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
                    <h2 id="guest-list-heading" className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Huéspedes de la reserva</h2>

                    <ul aria-labelledby="guest-list-heading" className="space-y-2">
                    {/* Main guest (always shown with name if known from PMS) */}
                    {mainGuest ? (
                        <GuestRow
                            icon={isGuestDone(mainGuest)
                                ? <CheckCircle2 size={16} className="text-green-500" />
                                : <Circle size={16} className="text-slate-300" />
                            }
                            name={`${mainGuest.name} ${mainGuest.lastname}`.trim() || "Titular de la reserva"}
                            badges={
                                <>
                                    <span className={BADGE_MAIN}>Principal</span>
                                    {isGuestDone(mainGuest)
                                        ? <span className={BADGE_DONE}>Completado</span>
                                        : <span className={BADGE_PENDING}>Pendiente</span>
                                    }
                                </>
                            }
                        />
                    ) : (
                        /* No main guest in registeredGuests yet — the fixed CTA starts the flow */
                        <GuestRow
                            icon={<Circle size={16} className="text-slate-300" />}
                            name="Titular de la reserva"
                            badges={
                                <>
                                    <span className={BADGE_MAIN}>Principal</span>
                                    <span className={BADGE_PENDING}>Pendiente</span>
                                </>
                            }
                        />
                    )}

                    {/* Secondary guests that already completed /identify (have real names) */}
                    {knownNonMainGuests.map(g => (
                        <GuestRow
                            key={g.uuid}
                            icon={isGuestDone(g)
                                ? <CheckCircle2 size={16} className="text-green-500" />
                                : <Circle size={16} className="text-slate-300" />
                            }
                            name={`${g.name} ${g.lastname}`.trim()}
                            badges={
                                isGuestDone(g) ? (
                                    <span className={BADGE_DONE}>Completado</span>
                                ) : mainCompleted ? (
                                    <span className={BADGE_PENDING}>Pendiente</span>
                                ) : (
                                    <span className={BADGE_LOCKED}>
                                        <Lock size={11} />
                                        Esperando al titular
                                    </span>
                                )
                            }
                            actions={!isGuestDone(g) && mainCompleted && checkinOpen ? (
                                <GuestRowActions
                                    href={getContinueLink(g)}
                                    shareLabel={`Enviar link a ${g.name}`}
                                    onShare={() => handleShareLink(g.name)}
                                    emphasis="solid"
                                />
                            ) : undefined}
                        />
                    ))}

                    {/* Anonymous slots — guests we don't know yet */}
                    {Array.from({ length: anonymousSlotsCount }, (_, i) => {
                        const slotNumber = registeredGuests.length + i + 1
                        return (
                            <GuestRow
                                key={`anon-${i}`}
                                icon={<UserCircle size={16} className="text-slate-300" />}
                                name={`Huésped ${slotNumber}`}
                                nameClassName="italic text-slate-400"
                                badges={mainCompleted ? (
                                    <span className={BADGE_PENDING}>Sin registrar</span>
                                ) : (
                                    <span className={BADGE_LOCKED_MUTED}>
                                        <Lock size={11} />
                                        Esperando al titular
                                    </span>
                                )}
                                actions={mainCompleted && checkinOpen ? (
                                    <GuestRowActions
                                        href={`${basePath}/s/new-${slotNumber}/identify`}
                                        shareLabel={`Enviar link al huésped ${slotNumber}`}
                                        onShare={() => handleShareLink(`Huésped ${slotNumber}`)}
                                        emphasis="soft"
                                    />
                                ) : undefined}
                            />
                        )
                    })}
                    </ul>

                    {/* Re-send the link so companions can register themselves. */}
                    {hasPendingCompanions && (
                        <div className="mt-3 rounded-xl border border-brand-purple/15 bg-brand-purple/5 p-3">
                            <p className="text-xs font-medium text-slate-600 mb-2">
                                ¿Viajas acompañado? Envíales el link para que hagan su registro.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleShareLink()}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-brand-purple text-white text-sm font-bold hover:bg-brand-purple/90 transition-colors active:scale-[0.98]"
                                >
                                    <Share2 size={15} />
                                    Compartir link
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCopyLink()}
                                    className="inline-flex items-center justify-center h-10 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                                >
                                    Copiar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {mainCompleted && (
                <AccessInstructionsPanel portal={portal} unlocked={isFullyCompleted} />
            )}

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
                <div className={BOTTOM_BAR}>
                    <div className={BOTTOM_BAR_INNER}>
                        <Link
                            href={`${basePath}/success`}
                            className="w-full flex items-center justify-center h-14 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-base shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                        >
                            Ver Resumen de Check-in
                        </Link>
                    </div>
                </div>
            ) : primaryCtaHref ? (
                <div className={BOTTOM_BAR}>
                    <div className={BOTTOM_BAR_INNER}>
                        <Link
                            href={primaryCtaHref}
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-base shadow-lg shadow-brand-purple/25 transition-all active:scale-[0.98]"
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
