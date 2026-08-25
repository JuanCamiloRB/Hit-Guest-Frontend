"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface CheckinErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

/**
 * Segment boundary for the public check-in flow.
 *
 * A malformed runtime response must not strand a guest on Next.js' generic
 * client-side exception page after they have submitted identity, card or
 * signature data. `reset` retries the failed route without discarding the URL;
 * the home link remains as a safe escape hatch.
 */
export default function CheckinError({ error, reset }: CheckinErrorProps) {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)
    const stepIndex = segments.findIndex((segment, index) =>
        index > 1 && ["identify", "verify", "contact-challenge", "guest", "contract", "success"].includes(segment),
    )
    // Preserve every route discriminator before the current step: reservation
    // UUID, external-source path, or `/s/{guestToken}`. `/checkin` itself is an
    // admin-login redirect and is not a valid guest escape hatch.
    const checkinHome = `/${(stepIndex >= 0 ? segments.slice(0, stepIndex) : segments).join("/")}`

    useEffect(() => {
        console.error("[checkin] Unhandled route error", error)
        // La consola de arriba vive en el teléfono del huésped — inalcanzable.
        // El beacon sube el crash a los logs del servidor (/api/client-error)
        // para que un reporte por WhatsApp tenga con qué cruzarse. Mejor
        // esfuerzo a propósito: reportar el error nunca puede fallar el boundary.
        try {
            const report = JSON.stringify({
                digest: error.digest ?? null,
                message: String(error.message ?? "").slice(0, 500),
                pathname,
            })
            const sent = typeof navigator.sendBeacon === "function"
                && navigator.sendBeacon("/api/client-error", new Blob([report], { type: "application/json" }))
            if (!sent) {
                fetch("/api/client-error", { method: "POST", body: report, keepalive: true }).catch(() => {})
            }
        } catch {}
    }, [error, pathname])

    return (
        <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-100 bg-amber-50">
                <AlertTriangle className="text-amber-500" size={34} />
            </div>
            <div className="max-w-sm space-y-2">
                <h1 className="text-xl font-bold text-slate-900">No pudimos mostrar este paso</h1>
                <p className="text-sm text-slate-500">
                    Intenta cargar nuevamente. Si ya habías enviado información, no repitas el proceso hasta
                    confirmar su estado; si el problema continúa, contacta al alojamiento.
                </p>
                {/* Referencia legible en un screenshot — mismo criterio que los
                    códigos SETUP-* del formulario de garantía. Solo existe para
                    errores de servidor (Next la genera como `digest`). */}
                {error.digest && (
                    <p className="text-xs text-slate-400">Referencia: {error.digest}</p>
                )}
            </div>
            <div className="flex w-full max-w-sm flex-col gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-purple font-bold text-white"
                >
                    <RefreshCw size={17} /> Reintentar
                </button>
                <Link
                    href={checkinHome}
                    className="flex h-12 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700"
                >
                    Volver al inicio
                </Link>
            </div>
        </main>
    )
}
