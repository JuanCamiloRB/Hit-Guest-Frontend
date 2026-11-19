"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { IconBadge } from "@/components/ui/icon-badge"

interface DashboardErrorProps {
    error: Error & { digest?: string }
    reset: () => void
}

/**
 * Límite de error del panel del PM. Sin él, cualquier error de render (como la
 * tarjeta de Kunas que se cayó en producción el 2026-11-18 al leer
 * `parameters.email` de una respuesta incompleta) dejaba la pantalla en blanco
 * con el mensaje genérico de Next. Vive dentro del layout: la barra lateral y
 * el encabezado siguen, y el PM puede reintentar o irse a otra sección.
 *
 * Mismo esquema que el del check-in (`(guest)/checkin/error.tsx`): el error se
 * sube a los logs del servidor (`/api/client-error`), con esfuerzo mínimo:
 * reportar nunca puede fallar el límite.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
    const pathname = usePathname()

    useEffect(() => {
        console.error("[dashboard] Unhandled route error", error)
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
        <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
            <IconBadge icon={AlertTriangle} tone="warning" size="xl" />
            <div className="max-w-md space-y-2">
                <Heading level={1} size="title">No pudimos mostrar esta sección</Heading>
                <p className="text-sm text-ink-3">
                    Intenta cargarla de nuevo. Tus datos no se perdieron: el problema fue al mostrarlos. Si se repite,
                    escríbenos con la referencia de abajo.
                </p>
                {error.digest && <p className="text-xs text-ink-3">Referencia: {error.digest}</p>}
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3">
                <Button type="button" onClick={reset}>
                    <Icon icon={RefreshCw} /> Reintentar
                </Button>
                <Button asChild variant="outline">
                    <Link href="/dashboard">Ir al tablero</Link>
                </Button>
            </div>
        </div>
    )
}
