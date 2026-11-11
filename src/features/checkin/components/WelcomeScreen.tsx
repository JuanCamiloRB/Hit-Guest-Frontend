"use client"

import { useEffect, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Clock, CreditCard, IdCard, Key, ShieldCheck, Calendar, Users, CheckCircle2, Lock, UserCircle, ArrowRight, Share2, Mail } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import type { CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { isMainGuestCompleted } from "@/features/checkin/types/checkin"
import { resolveContractSigningState } from "@/features/checkin/lib/contract-signing"
import { AccessInstructionsPanel } from "./AccessInstructionsPanel"
import { Button } from "@/components/ui/button"

interface WelcomeScreenProps {
    portal: CheckinPortalResponse
    basePath: string
}

// Shared badge tokens so every guest row reads the same way. All of them share
// the same size/shape — only the color changes — so "Principal" next to
// "Pendiente" doesn't look like two different design systems.
const BADGE_BASE = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold leading-5"
const BADGE_MAIN = `${BADGE_BASE} bg-primary/10 text-primary`
const BADGE_DONE = `${BADGE_BASE} bg-success-sunk text-success`
const BADGE_PENDING = `${BADGE_BASE} bg-sunk text-ink-3`

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
const BOTTOM_BAR = "fixed bottom-0 left-0 right-0 z-10 flex justify-center border-t border-rule/70 bg-white/95 py-4 backdrop-blur-md"
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
    nameClassName = "text-ink-2",
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
        <li className="flex items-start gap-2.5 rounded-xl border border-rule/50 bg-sunk/50 p-3">
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
            <Button asChild size="sm" variant={emphasis === "solid" ? "secondary" : "outline"} className="flex-1">
                <Link href={href}>
                    Registrar <Icon icon={ArrowRight} size="sm" />
                </Link>
            </Button>
            <Button variant="outline" size="icon-sm"
                type="button"
                onClick={onShare}
                aria-label={shareLabel}
                title={shareLabel}
                className="shrink-0"
            >
                <Icon icon={Share2} size="sm" />
            </Button>
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

    /**
     * El titular ya llenó todo y lo único que falta es que firme desde el correo
     * de TuFirma.
     *
     * Con firma externa `isCompleted` NO pasa a `true` hasta que llega el webhook,
     * así que sin esto el hub lo mostraba igual que a alguien que no empezó
     * ("Pendiente" + "Continuar mi registro") y lo mandaba a rehacer un formulario
     * que ya había enviado. La diferencia importa porque la acción que resuelve el
     * check-in no está en el portal, está en su bandeja de entrada.
     */
    const mainAwaitingExternalSignature =
        !mainCompleted && resolveContractSigningState(portal.contract) === "awaiting_external"

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

    const completedCount = progress.completed

    const arrival = new Date(res.arrivalDate + "T12:00:00")
    const departure = new Date(res.departureDate + "T12:00:00")
    const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + "T12:00:00")
        return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
    }

    const isFullyCompleted = progress.isFullyCompleted

    // ── Guest list logic ──────────────────────────────────────────────────────
    // El titular SIEMPRE ocupa un cupo, esté registrado o no. Antes se restaban
    // solo los registrados: sin titular todavía, una reserva de 2 mostraba
    // «Titular + Huésped 1 + Huésped 2» (reporte de Didier, 2026-10-19).
    const knownNonMainGuests = registeredGuests.filter(g => !g.isMain)
    const companionsTotal = Math.max(0, res.totalGuestsAllowed - 1)
    const anonymousSlotsCount = Math.max(0, companionsTotal - knownNonMainGuests.length)

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
        if (mainAwaitingExternalSignature && mainGuest) {
            // Se lo lleva a la pantalla del contrato, que en este estado explica que
            // la firma está en su correo. "Continuar mi registro" sería falso: no
            // hay nada más que llenar.
            primaryCtaHref = `${basePath}/contract?guest_uuid=${mainGuest.uuid}`
            primaryCtaLabel = "Ver estado de mi firma"
        } else if (!mainCompleted) {
            primaryCtaHref = mainGuest ? getContinueLink(mainGuest) : `${basePath}/identify`
            primaryCtaLabel = mainGuest ? "Continuar mi registro" : "Comenzar mi registro"
        } else {
            const nextKnown = knownNonMainGuests.find(g => !isGuestDone(g))
            if (nextKnown) {
                primaryCtaHref = getContinueLink(nextKnown)
                primaryCtaLabel = "Registrar acompañante"
            } else if (anonymousSlotsCount > 0) {
                // Mismo índice que la fila del primer acompañante sin registrar.
                primaryCtaHref = `${basePath}/s/new-${knownNonMainGuests.length + 2}/identify`
                primaryCtaLabel = "Registrar acompañante"
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
                <h1 className="text-3xl font-bold tracking-tight text-ink leading-tight">
                    Check-in Online
                </h1>
                <p className="text-ink-3 text-base">
                    Completa tu registro antes de la fecha de llegada.
                </p>
            </div>

            {/* Reservation Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-rule space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-xs font-bold text-ink-3">Llegada</span>
                        <p className="font-medium mt-0.5 text-ink">{formatDate(res.arrivalDate)}</p>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-ink-3">Salida</span>
                        <p className="font-medium mt-0.5 text-ink">{formatDate(res.departureDate)}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="flex-1 bg-sunk/50 rounded-xl p-3 border border-rule/50 flex items-center gap-2">
                        <Icon icon={Calendar} className="text-secondary" />
                        <span className="text-sm font-medium text-ink-2">{nights} {nights === 1 ? "Noche" : "Noches"}</span>
                    </div>
                    <div className="flex-1 bg-sunk/50 rounded-xl p-3 border border-rule/50 flex items-center gap-2">
                        <Icon icon={Users} className="text-secondary" />
                        <span className="text-sm font-medium text-ink-2">{res.totalGuestsAllowed} {res.totalGuestsAllowed === 1 ? "Huésped" : "Huéspedes"}</span>
                    </div>
                </div>

                {/* El registro está cerrado para esta reserva: se explica una vez,
                    en vez de dejar que el huésped lo descubra chocando con un 422
                    después de llenar el formulario. */}
                {!checkinOpen && (
                    <div className="flex items-start gap-3 rounded-xl border border-rule bg-sunk/50 p-3">
                        <Icon icon={Lock} className="text-ink-3 mt-0.5" />
                        <p className="text-xs text-ink-2 leading-relaxed">
                            El registro en línea está cerrado para esta reserva. Puedes seguir
                            consultando tus documentos, pero si necesitas modificar algo
                            contacta al anfitrión.
                        </p>
                    </div>
                )}

                {/* Antes de que el titular termine, solo lo que cambia lo que tiene
                    que hacer: quién va primero y, si aplica, que falta su firma.
                    Sin lista de personas, círculos ni candados — parecían una
                    selección obligatoria y la gente los tocaba en vez de avanzar. */}
                {!mainCompleted && companionsTotal > 0 && (
                    <p className="text-sm text-ink-2">
                        Primero te registras tú. Después podrás registrar{" "}
                        {companionsTotal === 1 ? "a tu acompañante" : `a tus ${companionsTotal} acompañantes`}.
                    </p>
                )}
                {mainAwaitingExternalSignature && (
                    <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-sunk p-3">
                        <Icon icon={Mail} className="text-warning mt-0.5" />
                        <p className="text-xs text-warning leading-relaxed">
                            <span className="font-semibold">Falta firmar</span>: tu registro está guardado.
                            Te enviamos el contrato por correo para firmarlo.
                        </p>
                    </div>
                )}

                {mainCompleted && (
                <>
                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-3 font-medium">Progreso del registro</span>
                        <span className="font-bold text-primary">
                            {completedCount}/{res.totalGuestsAllowed} completados
                        </span>
                    </div>
                    <div className="h-2 w-full bg-sunk rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${res.totalGuestsAllowed > 0
                                ? Math.min(100, (completedCount / res.totalGuestsAllowed) * 100)
                                : 0}%` }}
                        />
                    </div>
                </div>

                {/* Lista: solo con el titular terminado, que es cuando sirve. Sin
                    círculos (parecían una selección): check verde o la persona. */}
                <div className="space-y-2 pt-1">
                    <h2 id="guest-list-heading" className="text-xs font-bold text-ink-3">Huéspedes de la reserva</h2>

                    <ul aria-labelledby="guest-list-heading" className="space-y-2">
                    {mainGuest && (
                        <GuestRow
                            icon={<Icon icon={CheckCircle2} className="text-success" />}
                            name={`${mainGuest.name} ${mainGuest.lastname}`.trim() || "Titular"}
                            badges={
                                <>
                                    <span className={BADGE_MAIN}>Titular</span>
                                    <span className={BADGE_DONE}>Completado</span>
                                </>
                            }
                        />
                    )}

                    {/* Acompañantes que ya se identificaron (tienen nombre) */}
                    {knownNonMainGuests.map(g => (
                        <GuestRow
                            key={g.uuid}
                            icon={isGuestDone(g)
                                ? <Icon icon={CheckCircle2} className="text-success" />
                                : <Icon icon={UserCircle} className="text-ink-4" />
                            }
                            name={`${g.name} ${g.lastname}`.trim()}
                            badges={isGuestDone(g)
                                ? <span className={BADGE_DONE}>Completado</span>
                                : <span className={BADGE_PENDING}>Pendiente</span>
                            }
                            actions={!isGuestDone(g) && checkinOpen ? (
                                <GuestRowActions
                                    href={getContinueLink(g)}
                                    shareLabel={`Enviar link a ${g.name}`}
                                    onShare={() => handleShareLink(g.name)}
                                    emphasis="solid"
                                />
                            ) : undefined}
                        />
                    ))}

                    {/* Acompañantes que todavía no se registraron */}
                    {Array.from({ length: anonymousSlotsCount }, (_, i) => {
                        const companionNumber = knownNonMainGuests.length + i + 1
                        // Índice de la ruta de alta: titular + acompañantes conocidos + este.
                        const slotNumber = 1 + companionNumber
                        const label = `Acompañante ${companionNumber}`
                        return (
                            <GuestRow
                                key={`anon-${i}`}
                                icon={<Icon icon={UserCircle} className="text-ink-4" />}
                                name={label}
                                nameClassName="italic text-ink-3"
                                badges={<span className={BADGE_PENDING}>Sin registrar</span>}
                                actions={checkinOpen ? (
                                    <GuestRowActions
                                        href={`${basePath}/s/new-${slotNumber}/identify`}
                                        shareLabel={`Enviar link al ${label.toLowerCase()}`}
                                        onShare={() => handleShareLink(label)}
                                        emphasis="soft"
                                    />
                                ) : undefined}
                            />
                        )
                    })}
                    </ul>

                    {/* Re-send the link so companions can register themselves. */}
                    {hasPendingCompanions && (
                        <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
                            <p className="text-xs font-medium text-ink-2 mb-2">
                                ¿Viajas acompañado? Envíales el link para que hagan su registro.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    onClick={() => handleShareLink()}
                                    className="flex-1 inline-flex items-center justify-center"
                                >
                                    <Icon icon={Share2} />
                                    Compartir link
                                </Button>
                                <Button variant="outline"
                                    type="button"
                                    onClick={() => handleCopyLink()}
                                    className="inline-flex items-center justify-center"
                                >
                                    Copiar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                </>
                )}
            </div>

            {mainCompleted && (
                <AccessInstructionsPanel portal={portal} unlocked={isFullyCompleted} />
            )}

            {/* Info Box */}
            {!isFullyCompleted && (
                <div className="bg-secondary/5 rounded-xl p-5 border border-secondary/10">
                    <div className="flex items-center gap-3 mb-4 text-secondary">
                        <Icon icon={Clock} size="lg" />
                        <span className="font-semibold">Tomará aproximadamente 3 minutos</span>
                    </div>
                    <p className="text-sm text-ink-2 mb-4 font-medium">Requisitos para completar el registro:</p>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm border border-rule text-primary">
                                <Icon icon={IdCard} size="lg" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Documento de identidad</p>
                                <p className="text-xs text-ink-3 mt-0.5">Pasaporte o cédula original de todos los adultos.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm border border-rule text-primary">
                                <Icon icon={CreditCard} size="lg" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink">Datos de contacto</p>
                                <p className="text-xs text-ink-3 mt-0.5">Teléfono, email y datos de viaje del titular.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            )}

            {/* Security */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center text-center bg-white border border-rule p-4 rounded-xl shadow-sm">
                    <Icon icon={ShieldCheck} size="2xl" className="text-success mb-2" />
                    <span className="text-xs font-semibold text-ink">Cifrado Seguro</span>
                    <span className="text-xs text-ink-3 mt-0.5">Datos protegidos</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center bg-white border border-rule p-4 rounded-xl shadow-sm">
                    <Icon icon={Key} size="2xl" className="text-warning mb-2" />
                    <span className="text-xs font-semibold text-ink">Acceso Rápido</span>
                    <span className="text-xs text-ink-3 mt-0.5">Evita la recepción</span>
                </div>
            </div>

            {/* Global CTA — big, unmissable primary action fixed at the bottom. */}
            {isFullyCompleted ? (
                <div className={BOTTOM_BAR}>
                    <div className={BOTTOM_BAR_INNER}>
                        <Button asChild size="xl">
                            <Link
                                href={`${basePath}/success`}
                                className="w-full"
                            >
                                Ver Resumen de Check-in
                            </Link>
                        </Button>
                    </div>
                </div>
            ) : primaryCtaHref ? (
                <div className={BOTTOM_BAR}>
                    <div className={BOTTOM_BAR_INNER}>
                        <Button asChild size="xl">
                            <Link
                                href={primaryCtaHref}
                                className="w-full"
                            >
                                {primaryCtaLabel}
                                <Icon icon={ArrowRight} size="lg" />
                            </Link>
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
