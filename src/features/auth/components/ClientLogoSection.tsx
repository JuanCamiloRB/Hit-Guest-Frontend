"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authService } from "@/features/auth/services/auth-service"
import { ApiError } from "@/types/api"
import { handleSessionExpired } from "@/lib/api-client"

const ACCEPTED = ["image/png", "image/jpeg"]
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

interface ClientLogoSectionProps {
    /** Client uuid from GET /account; null when the backend didn't return it. */
    clientUuid: string | null
    initialLogoUrl: string | null
}

/**
 * Client logo upload for "Mi cuenta". The logo is the CLIENTE's letterhead on
 * every PDF HIT Guest generates. Backend resizes automatically (≤350px), so we
 * send the original file untouched. Client-side validation is only for instant
 * feedback — the 422 from the server is the source of truth.
 */
export function ClientLogoSection({ clientUuid, initialLogoUrl }: ClientLogoSectionProps) {
    const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const disabled = !clientUuid || busy

    const pickFile = () => {
        setError(null)
        inputRef.current?.click()
    }

    const validate = (file: File): string | null => {
        if (!ACCEPTED.includes(file.type)) return "Formato no soportado. Sube una imagen PNG o JPEG."
        if (file.size > MAX_BYTES) return "El archivo supera el máximo de 2 MB."
        return null
    }

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        // Reset the input so selecting the same file again re-triggers change.
        e.target.value = ""
        if (!file || !clientUuid) return

        const localError = validate(file)
        if (localError) {
            setError(localError)
            return
        }

        setBusy(true)
        setError(null)
        try {
            const newUrl = await authService.uploadLogo(clientUuid, file)
            setLogoUrl(newUrl)
            toast.success("Logo actualizado")
        } catch (err) {
            handleLogoError(err, "No se pudo subir el logo")
        } finally {
            setBusy(false)
        }
    }

    const handleDelete = async () => {
        if (!clientUuid) return
        if (!confirm("¿Eliminar el logo de la cuenta?")) return
        setBusy(true)
        setError(null)
        try {
            await authService.deleteLogo(clientUuid)
            setLogoUrl(null)
            toast.success("Logo eliminado")
        } catch (err) {
            handleLogoError(err, "No se pudo eliminar el logo")
        } finally {
            setBusy(false)
        }
    }

    const handleLogoError = (err: unknown, fallback: string) => {
        if (err instanceof ApiError) {
            if (err.status === 401) {
                handleSessionExpired()
                return
            }
            if (err.status === 403) {
                setError("No tienes permiso para modificar el logo de esta cuenta.")
                return
            }
            // 422: surface the field message from errors.logo[0] (a Record<string,string[]>).
            const errs = err.errors
            const fieldMsg =
                errs && !Array.isArray(errs) && typeof errs === "object"
                    ? errs.logo?.[0]
                    : undefined
            setError(fieldMsg || err.message || fallback)
            return
        }
        setError(fallback)
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Logo de la cuenta</h3>
                <p className="text-xs text-slate-500">
                    Aparecerá como membrete en los documentos que genera HIT Guest (reportes,
                    contratos, etc.). Se ajusta automáticamente para verse bien. PNG o JPEG, máx. 2 MB.
                </p>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFile}
                className="hidden"
            />

            <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {logoUrl ? (
                        // Backend host is allow-listed in next.config; unoptimized keeps
                        // it simple for an arbitrary stored URL.
                        <Image
                            src={logoUrl}
                            alt="Logo de la cuenta"
                            width={96}
                            height={96}
                            unoptimized
                            className="h-full w-full object-contain"
                        />
                    ) : (
                        <ImageIcon className="h-8 w-8 text-slate-300" />
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={pickFile}
                            disabled={disabled}
                            className="gap-1.5"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {logoUrl ? "Reemplazar" : "Subir logo"}
                        </Button>
                        {logoUrl && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleDelete}
                                disabled={disabled}
                                className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                            </Button>
                        )}
                    </div>
                    {!clientUuid && (
                        <p className="text-[11px] text-amber-600">
                            No se pudo identificar la cuenta; recarga la página para subir un logo.
                        </p>
                    )}
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                </p>
            )}
        </div>
    )
}
