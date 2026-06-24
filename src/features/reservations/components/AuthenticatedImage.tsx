"use client"

import { useEffect, useState } from "react"
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
    const [objectUrl, setObjectUrl] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading")

    useEffect(() => {
        let revoked: string | null = null
        let mounted = true
        setStatus("loading")

        const token = useAuthStore.getState().user?.token || CONFIG.APP_API_TOKEN
        const headers: Record<string, string> = { Accept: "image/*" }
        if (token) headers["Authorization"] = `Bearer ${token}`

        fetch(src, { headers, cache: "no-store" })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const blob = await res.blob()
                if (!mounted) return
                const url = URL.createObjectURL(blob)
                revoked = url
                setObjectUrl(url)
                setStatus("loaded")
            })
            .catch(() => {
                if (mounted) setStatus("error")
            })

        return () => {
            mounted = false
            if (revoked) URL.revokeObjectURL(revoked)
        }
    }, [src])

    if (status === "loading") {
        return (
            <div className={`flex items-center justify-center bg-slate-50 ${className ?? ""}`}>
                <Loader2 size={18} className="animate-spin text-slate-300" />
            </div>
        )
    }

    if (status === "error" || !objectUrl) {
        return (
            <div className={`flex items-center justify-center bg-slate-50 ${className ?? ""}`}>
                <ImageOff size={18} className="text-slate-300" />
            </div>
        )
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img src={objectUrl} alt={alt} className={className} />
}
