"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, FileText, XCircle } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Surface } from "@/components/ui/card"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { Button } from "@/components/ui/button"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Heading } from "@/components/ui/heading"
import { LoadingState } from "@/components/ui/loading-state"

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
            <LoadingState variant="spinner" page showLabel label="Cargando documento..." />
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-in fade-in px-4">
                <div className="w-16 h-16 rounded-full bg-danger-sunk flex items-center justify-center">
                    <Icon icon={XCircle} size="2xl" className="text-danger" />
                </div>
                <Heading level={2}>Documento no disponible</Heading>
                <p className="text-ink-3 text-sm max-w-sm">{error}</p>
                <Button type="button"
                    onClick={() => router.push(basePath)}
                    className="mt-2"
                >
                    Volver al check-in
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <div className="flex items-center justify-between">
                <UnstyledButton
                    onClick={() => router.push(basePath)}
                    className="flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-sunk text-ink-3 transition-colors"
                >
                    <Icon icon={ArrowLeft} size="lg" />
                    <span className="text-sm font-semibold">Volver</span>
                </UnstyledButton>
                <div className="flex items-center gap-2 text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-lg">
                    <Icon icon={FileText} size="sm" />
                    Documento
                </div>
            </div>

            <Surface
                flat
                className="p-6 prose prose-sm prose-slate max-w-none [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: rendered }}
            />

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-rule/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <Button type="button" size="xl" onClick={handleDownloadPdf} className="w-full flex items-center justify-center" loading={isDownloading}>
                        <Icon icon={Download} size="lg" />
                        Descargar PDF
                    </Button>
                </div>
            </div>
        </div>
    )
}
