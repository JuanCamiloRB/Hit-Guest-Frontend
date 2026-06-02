"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"

interface DiditCallbackClientProps {
    verificationSessionId: string
    status: string
}

type CallbackState = "redirecting" | "failed" | "no_context"

interface PendingDiditContext {
    reservationUuid: string
    guestUuid: string
    basePath: string
    step: "biometric" | "kyc"
    startedAt: number
}

function readPendingContext(): PendingDiditContext | null {
    try {
        const raw = localStorage.getItem("checkin-pending-didit")
        if (!raw) return null
        const ctx = JSON.parse(raw) as PendingDiditContext
        if (!ctx.reservationUuid || !ctx.guestUuid || !ctx.basePath) return null
        // Expire context after 30 minutes
        if (Date.now() - ctx.startedAt > 30 * 60 * 1000) {
            localStorage.removeItem("checkin-pending-didit")
            return null
        }
        return ctx
    } catch {
        return null
    }
}

export function DiditCallbackClient({ status }: DiditCallbackClientProps) {
    const router = useRouter()
    const [state, setState] = useState<CallbackState>("redirecting")

    useEffect(() => {
        const ctx = readPendingContext()

        if (!ctx) {
            setState("no_context")
            return
        }

        if (status === "Approved") {
            // Redirect to VerifyScreen with fromCallback=1
            // VerifyScreen will start portal polling and navigate when verification.currentStep="form"
            router.replace(
                `${ctx.basePath}/verify?guest_uuid=${ctx.guestUuid}&from_didit_callback=1`
            )
        } else {
            // Didit sent Declined / Expired / Abandoned — show error briefly, then redirect back
            setState("failed")
            setTimeout(() => {
                router.replace(
                    `${ctx.basePath}/verify?guest_uuid=${ctx.guestUuid}&didit_error=${encodeURIComponent(status)}`
                )
            }, 2000)
        }
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
