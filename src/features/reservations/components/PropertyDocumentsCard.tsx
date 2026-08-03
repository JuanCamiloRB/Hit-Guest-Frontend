"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    FileText,
    Loader2,
    Eye,
    Download,
    ChevronDown,
    ChevronUp,
    X,
} from "lucide-react"
import { propertyDocumentService } from "@/features/properties/services/property-document-service"
import { reservationsService } from "../services/reservations-service"
import type { PropertyDocument } from "@/features/properties/types/document"
import { documentTypeLabel, DOCUMENT_STATUS } from "@/features/properties/types/document"
import { notifyError } from "@/lib/notify-error"

interface PropertyDocumentsCardProps {
    reservationUuid: string
}

export function PropertyDocumentsCard({ reservationUuid }: PropertyDocumentsCardProps) {
    const [documents, setDocuments] = useState<PropertyDocument[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [propertyUuid, setPropertyUuid] = useState<string | null>(null)

    const [previewDoc, setPreviewDoc] = useState<string | null>(null)
    const [previewHtml, setPreviewHtml] = useState<string>("")
    const [previewLoading, setPreviewLoading] = useState(false)
    const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                const raw = await reservationsService.getRawById(reservationUuid)
                const propUuid = raw.listing?.property?.uuid
                    || raw.listing?.propertyUuid
                    || raw.listing?.property_uuid
                if (!propUuid) {
                    if (mounted) setIsLoading(false)
                    return
                }
                if (mounted) setPropertyUuid(propUuid)

                const { items } = await propertyDocumentService.list(propUuid, { perPage: 50 })
                const active = items.filter(d =>
                    d.statusRecord?.id === DOCUMENT_STATUS.ACTIVE && !d.deletedAt
                )
                if (mounted) setDocuments(active)
            } catch (error) {
                console.error("[PropertyDocumentsCard] Error:", error)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [reservationUuid])

    const handlePreview = async (doc: PropertyDocument) => {
        if (previewDoc === doc.uuid) {
            setPreviewDoc(null)
            setPreviewHtml("")
            return
        }
        setPreviewDoc(doc.uuid)
        setPreviewLoading(true)
        setPreviewHtml("")
        try {
            const html = await propertyDocumentService.render(reservationUuid, doc.uuid)
            setPreviewHtml(html)
        } catch (err) {
            notifyError(err, "No se pudo renderizar el documento")
            setPreviewDoc(null)
        } finally {
            setPreviewLoading(false)
        }
    }

    const handleDownloadPdf = async (doc: PropertyDocument) => {
        setDownloadingPdf(doc.uuid)
        try {
            await propertyDocumentService.openPdf(reservationUuid, doc.uuid)
        } catch (err) {
            notifyError(err, "No se pudo descargar el PDF")
        } finally {
            setDownloadingPdf(null)
        }
    }

    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-primary" />
                        Documentos de la Propiedad
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Cargando...</span>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (documents.length === 0) return null

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    Documentos de la Propiedad
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {documents.length} {documents.length === 1 ? "documento" : "documentos"}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {documents.map((doc) => (
                    <div key={doc.uuid} className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <FileText size={16} className="text-primary" />
                                </div>
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">
                                        {documentTypeLabel(doc.documentType)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePreview(doc)}
                                    className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                    title="Vista previa"
                                >
                                    {previewDoc === doc.uuid
                                        ? <ChevronUp size={16} />
                                        : <Eye size={16} />
                                    }
                                </button>
                                <button
                                    onClick={() => handleDownloadPdf(doc)}
                                    disabled={downloadingPdf === doc.uuid}
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50"
                                    title="Descargar PDF"
                                >
                                    {downloadingPdf === doc.uuid
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <Download size={16} />
                                    }
                                </button>
                            </div>
                        </div>

                        {previewDoc === doc.uuid && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                                {previewLoading ? (
                                    <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span className="text-xs">Renderizando documento...</span>
                                    </div>
                                ) : (
                                    <div
                                        className="prose prose-sm prose-slate max-w-none max-h-72 overflow-y-auto text-xs [&_p]:my-1.5 [&_h2]:text-sm [&_h2]:font-bold"
                                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
