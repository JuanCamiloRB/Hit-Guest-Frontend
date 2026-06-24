"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, FileText, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"

interface GuestDocumentScreenProps {
    reservationUuid: string
    documentUuid: string
    basePath: string
}

export function GuestDocumentScreen({ reservationUuid, documentUuid, basePath }: GuestDocumentScreenProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [rendered, setRendered] = useState<string>("")
    const [isDownloading, setIsDownloading] = useState(false)

    useEffect(() => {
        let mounted = true
        checkinService.renderDocument(reservationUuid, documentUuid)
            .then(html => {
                if (!mounted) return
                setRendered(html)
                setIsLoading(false)
            })
            .catch(err => {
                if (!mounted) return
                setError(err.message || "No fue posible cargar el documento")
                setIsLoading(false)
            })
        return () => { mounted = false }
    }, [reservationUuid, documentUuid])

    const handleDownloadPdf = async () => {
        setIsDownloading(true)
        try {
            await checkinService.openDocumentPdf(reservationUuid, documentUuid)
        } catch {
            toast.error("No fue posible descargar el PDF")
        } finally {
            setIsDownloading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
                <p className="text-sm font-medium text-slate-500">Cargando documento...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-in fade-in px-4">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800">Documento no disponible</h2>
                <p className="text-slate-500 text-sm max-w-sm">{error}</p>
                <button
                    onClick={() => router.push(basePath)}
                    className="mt-2 px-5 py-2.5 bg-brand-purple text-white rounded-xl font-semibold text-sm"
                >
                    Volver al check-in
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(basePath)}
                    className="flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="text-sm font-semibold">Volver</span>
                </button>
                <div className="flex items-center gap-2 text-xs font-semibold px-2 py-1 bg-brand-purple/10 text-brand-purple rounded-lg">
                    <FileText size={14} />
                    Documento
                </div>
            </div>

            <div
                className="bg-white border border-slate-200 rounded-2xl p-6 prose prose-sm prose-slate max-w-none [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: rendered }}
            />

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-60 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98]"
                    >
                        {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                        Descargar PDF
                    </button>
                </div>
            </div>
        </div>
    )
}
