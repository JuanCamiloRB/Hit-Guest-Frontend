"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, ImageOff } from "lucide-react"
import { useAuthStore } from "@/lib/store/auth-store"
import { CONFIG } from "@/lib/config"

interface AuthenticatedImageProps {
    /** Image URL. If it requires Bearer auth, it is fetched as a blob. */
    src: string
    alt: string
    className?: string
}

/**
 * Renders an image whose URL is behind Bearer authentication. The backend's
 * identity-document endpoints (v4.5) require the Authorization header, which a
 * plain <img src> cannot send — so we fetch the bytes as a blob with the token
 * and render an object URL instead. Public/legacy URLs work the same way.
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
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
        return (
            <div className={`flex items-center justify-center bg-slate-50 ${className ?? ""}`}>
                <ImageOff size={18} className="text-slate-300" />
            </div>
        )
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img src={result.objectUrl} alt={alt} className={className} />
}
