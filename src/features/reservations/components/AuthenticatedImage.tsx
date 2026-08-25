"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ImageOff } from "lucide-react"
import { useAuthStore } from "@/lib/store/auth-store"
import { CONFIG } from "@/lib/config"
import { describeImageError } from "./identity-document-meta"

interface AuthenticatedImageProps {
    /** Image URL. If it requires Bearer auth, it is fetched as a blob. */
    src: string
    alt: string
    className?: string
}

/**
 * Renders an image whose URL is behind Bearer authentication. The backend's
 * identity-document endpoints require the Authorization header, which a plain
 * <img src> cannot send — so we fetch the bytes as a blob with the token and
 * render an object URL instead. Public/legacy URLs work the same way.
 *
 * Verificado contra producción el 2026-08-18: la URL del documento responde
 * **401 sin token** y 200 image/jpeg con Bearer, y el CORS del backend permite
 * el header `authorization` desde otro origen.
 *
 * ## Dos decisiones que parecen omisiones y no lo son
 *
 * **Un 401 acá NO cierra la sesión.** Se muestra el aviso, pero no se llama a
 * `handleSessionExpired()`: una miniatura que falle echaría al PM a `/login` en
 * medio de la reserva que está revisando. Si la sesión de verdad expiró, la
 * siguiente llamada de `apiClient` lo resuelve. Es el mismo criterio que ya se
 * tomó en `sendCheckinLink` con `suppressUnauthorizedRedirect`.
 *
 * **No se reintenta.** El efecto depende de `[imageRequest, src]`, y
 * `imageRequest` es un `useMemo` sobre `[src]`: un re-render con la misma URL no
 * vuelve a pedir. Un 404 significa que el fichero no está, así que reintentar
 * solo gastaría requests.
 */
export function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
    const imageRequest = useMemo(() => {
        try {
            const apiOrigin = new URL(CONFIG.API_URL_GUEST).origin
            return {
                apiOrigin,
                resolvedUrl: new URL(src, apiOrigin),
            }
        } catch {
            return null
        }
    }, [src])

    const [result, setResult] = useState<{
        src: string
        objectUrl: string | null
        status: "loaded" | "error"
        /** Indefinido = falló la red, no el servidor. */
        httpStatus?: number
    } | null>(null)

    useEffect(() => {
        let revoked: string | null = null
        let mounted = true

        const token = useAuthStore.getState().user?.token
        const headers: Record<string, string> = { Accept: "image/*" }
        if (!imageRequest) return

        // Identity documents are account-scoped. Never fall back to the shared app
        // token, and never leak a PM bearer token to an external image host.
        if (token && imageRequest.resolvedUrl.origin === imageRequest.apiOrigin) {
            headers["Authorization"] = `Bearer ${token}`
        }

        fetch(imageRequest.resolvedUrl.toString(), { headers, cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) {
                    // El status viaja al estado (no se lanza y se pierde) porque cada
                    // causa se le explica distinto al PM: un 404 es "esta cara del
                    // documento no está", no "algo salió mal".
                    if (mounted) setResult({ src, objectUrl: null, status: "error", httpStatus: res.status })
                    return
                }
                const blob = await res.blob()
                if (!mounted) return
                const url = URL.createObjectURL(blob)
                revoked = url
                setResult({ src, objectUrl: url, status: "loaded" })
            })
            .catch(() => {
                if (mounted) setResult({ src, objectUrl: null, status: "error" })
            })

        return () => {
            mounted = false
            if (revoked) URL.revokeObjectURL(revoked)
        }
    }, [imageRequest, src])

    if (!imageRequest) {
        return (
            <div className={`flex items-center justify-center bg-slate-50 ${className ?? ""}`}>
                <ImageOff size={18} className="text-slate-300" />
            </div>
        )
    }

    if (!result || result.src !== src) {
        return (
            <div className={`flex items-center justify-center bg-slate-50 ${className ?? ""}`}>
                <Loader2 size={18} className="animate-spin text-slate-300" />
            </div>
        )
    }

    if (result.status === "error" || !result.objectUrl) {
        const { short, detail } = describeImageError(result.httpStatus)
        return (
            <div
                className={`flex flex-col items-center justify-center gap-1 bg-slate-50 p-2 text-center ${className ?? ""}`}
                title={detail}
            >
                <ImageOff size={18} aria-hidden className="text-slate-300" />
                <span className="text-[11px] leading-tight text-ink-3">{short}</span>
            </div>
        )
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img src={result.objectUrl} alt={alt} className={className} />
}
