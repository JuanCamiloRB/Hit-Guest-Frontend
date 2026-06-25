"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"

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

type CallbackState = "redirecting" | "failed" | "no_context"

interface PendingDiditContext {
    reservationUuid: string
    guestUuid: string
    basePath: string
    step: "biometric" | "kyc"
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
}

/**
 * Resolves the check-in context preferring localStorage, then falling back to the
 * reservation/guest passed via the URL. With just the reservation we can still
 * resume (land the guest on the welcome screen, which re-fetches the portal).
 */
function resolveContext(urlReservation?: string, urlGuest?: string): ResolvedContext | null {
    const ls = readPendingContext()
    const reservationUuid = ls?.reservationUuid || urlReservation || ""
    if (!reservationUuid) return null
    const guestUuid = ls?.guestUuid || urlGuest || undefined
    const basePath = ls?.basePath || `/checkin/${reservationUuid}`
    return { reservationUuid, guestUuid, basePath }
}

export function DiditCallbackClient({ status, reservationUuid, guestUuid }: DiditCallbackClientProps) {
    const router = useRouter()
    const [state, setState] = useState<CallbackState>("redirecting")

    useEffect(() => {
        const ctx = resolveContext(reservationUuid, guestUuid)

        if (!ctx) {
            setState("no_context")
            return
        }

        // Terminal failures: show error then send back to retry. Everything else
        // (Approved / In Review / In Progress) forwards to the verify screen, which
        // polls the portal — the source of truth for the final outcome.
        const FAILURE_STATUSES = ["declined", "expired", "abandoned", "failed", "rejected"]
        const isFailure = FAILURE_STATUSES.includes(status.toLowerCase())

        // Without a guestUuid we can't deep-link to /verify, so we resume on the
        // welcome screen which re-fetches the portal and routes the guest correctly.
        const verifyHref = ctx.guestUuid
            ? `${ctx.basePath}/verify?guest_uuid=${ctx.guestUuid}&from_didit_callback=1`
            : ctx.basePath

        if (!isFailure) {
            router.replace(verifyHref)
        } else {
            setState("failed")
            const failHref = ctx.guestUuid
                ? `${ctx.basePath}/verify?guest_uuid=${ctx.guestUuid}&didit_error=${encodeURIComponent(status)}`
                : ctx.basePath
            setTimeout(() => router.replace(failHref), 2000)
        }
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
            </div>
        </div>
    )
}
