"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"
import { checkinService } from "@/features/checkin/services/checkin-service"

interface DiditCallbackClientProps {
    verificationSessionId: string
    status: string
    /**
     * Reservation/guest recovered from the URL (when the backend appends them to the
     * callback, or when the callback lands on /checkin/{reference}). Used as a fallback
     * when the localStorage context is gone — which happens on mobile (WhatsApp in-app
     * browser → Safari, private mode, or a >2h gap don't share localStorage).
     */
    reservationUuid?: string
    guestUuid?: string
}

type CallbackState = "redirecting" | "failed" | "no_context" | "secondary_context_missing"

interface PendingDiditContext {
    reservationUuid: string
    guestUuid: string
    basePath: string
    step: "biometric" | "kyc"
    /** URL already consumed by Didit; VerifyScreen must not reopen it after remount. */
    launchedUrl?: string
    startedAt: number
}

// Context older than this is considered stale. Generous because document
// verification on mobile (with retries) can legitimately take a while.
const CONTEXT_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function readPendingContext(): PendingDiditContext | null {
    try {
        const raw = localStorage.getItem("checkin-pending-didit")
        if (!raw) return null
        const ctx = JSON.parse(raw) as PendingDiditContext
        if (!ctx.reservationUuid || !ctx.guestUuid || !ctx.basePath) return null
        if (Date.now() - ctx.startedAt > CONTEXT_TTL_MS) {
            localStorage.removeItem("checkin-pending-didit")
            return null
        }
        return ctx
    } catch {
        return null
    }
}

interface ResolvedContext {
    reservationUuid: string
    guestUuid?: string
    basePath: string
    /** True when the original /s/{guestToken} path survived in localStorage. */
    hasScopedBasePath: boolean
}

/**
 * Resolves the check-in context for THIS callback.
 *
 * The URL wins over localStorage. The backend puts reservation + guest in the
 * callback path precisely so the flow survives a lost or stale stored context;
 * preferring localStorage defeated that and actively misrouted the guest: a
 * guest who started a SECOND reservation within the 2h TTL (same guest uuid,
 * different reservation uuid) was sent back to the FIRST reservation, because
 * the stale entry outranked the correct value sitting in the URL.
 *
 * localStorage is still consulted, but only when it describes the same
 * reservation — it carries the secondary-guest basePath shape
 * (/checkin/{ref}/s/{guestToken}) that the URL alone cannot reconstruct.
 */
function resolveContext(urlReservation?: string, urlGuest?: string): ResolvedContext | null {
    const ls = readPendingContext()

    const reservationUuid = urlReservation || ls?.reservationUuid || ""
    if (!reservationUuid) return null

    const stored = ls && ls.reservationUuid === reservationUuid ? ls : null
    const guestUuid = urlGuest || stored?.guestUuid || undefined
    const basePath = stored?.basePath || `/checkin/${reservationUuid}`

    return { reservationUuid, guestUuid, basePath, hasScopedBasePath: stored != null }
}

export function DiditCallbackClient({
    verificationSessionId,
    status,
    reservationUuid,
    guestUuid,
}: DiditCallbackClientProps) {
    const router = useRouter()
    const [state, setState] = useState<CallbackState>("redirecting")

    useEffect(() => {
        let alive = true
        // Terminal failures: show error then send back to retry. Everything else
        // (Approved / In Review / In Progress) forwards to the verify screen, which
        // polls the portal — the source of truth for the final outcome.
        const FAILURE_STATUSES = ["declined", "expired", "abandoned", "failed", "rejected"]
        const isFailure = FAILURE_STATUSES.includes(status.toLowerCase())

        const routeTo = (ctx: ResolvedContext) => {
            // Without a guestUuid we can't deep-link to /verify, so we resume on the
            // welcome screen which re-fetches the portal and routes the guest correctly.
            if (!isFailure) {
                router.replace(
                    ctx.guestUuid
                        ? `${ctx.basePath}/verify?guest_uuid=${ctx.guestUuid}&from_didit_callback=1`
                        : ctx.basePath,
                )
                return
            }
            setState("failed")
            const failHref = ctx.guestUuid
                ? `${ctx.basePath}/verify?guest_uuid=${ctx.guestUuid}&didit_error=${encodeURIComponent(status)}`
                : ctx.basePath
            setTimeout(() => router.replace(failHref), 2000)
        }

        /**
         * A secondary callback cannot be reconstructed from reservation+guest:
         * its route also contains an opaque guestToken that neither callback
         * contract returns. Verify the guest role before using the generic main
         * route; otherwise we would cross the secondary security/routing boundary.
         */
        const routeWithKnownScope = async (ctx: ResolvedContext) => {
            if (!ctx.guestUuid || ctx.hasScopedBasePath) {
                routeTo(ctx)
                return
            }
            try {
                const portal = await checkinService.getPortal(ctx.reservationUuid)
                if (!alive) return
                const guest = portal.registeredGuests?.find((item) => item.uuid === ctx.guestUuid)
                if (!guest) {
                    setState("no_context")
                    return
                }
                if (!guest.isMain) {
                    setState("secondary_context_missing")
                    return
                }
                routeTo(ctx)
            } catch {
                if (alive) setState("no_context")
            }
        }

        // Camino normal: URL y/o localStorage alcanzan. Cuando sobrevivió el
        // basePath original se resuelve sin red; si solo quedaron reserva+guest,
        // el portal confirma el rol antes de usar la ruta genérica del titular.
        const local = resolveContext(reservationUuid, guestUuid)
        if (local) {
            void routeWithKnownScope(local)
            return () => { alive = false }
        }

        // Sin contexto local. Pasa de verdad: en navegadores embebidos
        // (WhatsApp/Instagram → Safari) y en modo privado el localStorage no se
        // comparte, y si el backend no anexó la reserva a la URL no queda nada que
        // leer. Antes esto terminaba en "Sesión expirada" y el huésped tenía que
        // rehacer la verificación entera.
        //
        // El `verificationSessionId` del callback sí sobrevive siempre, y el backend
        // sabe a qué reserva y huésped pertenece.
        if (!verificationSessionId) {
            // No se puede derivar del render: para llegar acá primero hay que
            // haber intentado resolver el contexto desde localStorage, que en el
            // servidor no existe.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setState("no_context")
            return
        }

        checkinService.resolveDiditSessionContext(verificationSessionId).then((remote) => {
            if (!alive) return
            if (!remote) {
                setState("no_context")
                return
            }
            void routeWithKnownScope({
                reservationUuid: remote.reservationUuid,
                guestUuid: remote.guestUuid,
                basePath: `/checkin/${remote.reservationUuid}`,
                hasScopedBasePath: false,
            })
        })
        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="text-center max-w-sm mx-auto">
                {state === "redirecting" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Verificación recibida
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Redirigiendo de vuelta al check-in...
                        </p>
                    </>
                )}

                {state === "failed" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                            <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Verificación no completada
                        </h2>
                        <p className="text-slate-500 text-sm">
                            La verificación no fue aprobada. Serás redirigido para intentar de nuevo.
                        </p>
                    </>
                )}

                {state === "no_context" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
                            <XCircle className="w-8 h-8 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Sesión expirada
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Tu sesión ha expirado. Por favor regresa al link de check-in original e intenta de nuevo.
                        </p>
                    </>
                )}

                {state === "secondary_context_missing" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
                            <XCircle className="w-8 h-8 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Vuelve a tu enlace de invitación
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Tu verificación fue recibida, pero necesitamos el enlace personal del acompañante para continuar de forma segura.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
