"use client"

import { useEffect, useState } from "react"
import { SectionCard } from "@/components/ui/section-card"
import {
    FileText,
    Loader2,
    Eye,
    Download,
    ChevronUp,
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
            <SectionCard title="Documentos de la propiedad">
                <div className="flex items-center justify-center gap-2 py-8 text-ink-3">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Cargando…</span>
                </div>
            </SectionCard>
        )
    }

    if (documents.length === 0) return null

    return (
        <SectionCard
            title="Documentos de la propiedad"
            description={`${documents.length} ${documents.length === 1 ? "documento activo" : "documentos activos"}`}
        >
            <div className="space-y-3">
                {documents.map((doc) => {
                    const isOpen = previewDoc === doc.uuid
                    const panelId = `doc-preview-${doc.uuid}`
                    return (
                        <div key={doc.uuid} className="overflow-hidden rounded-xl border border-rule">
                            <div className="flex items-center justify-between gap-3 p-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="rounded-lg bg-sunk p-2 text-ink-3">
                                        <FileText size={16} aria-hidden />
                                    </div>
                                    <span className="truncate text-sm font-semibold text-ink">
                                        {documentTypeLabel(doc.documentType)}
                                    </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        onClick={() => handlePreview(doc)}
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        title={isOpen ? "Ocultar vista previa" : "Vista previa"}
                                    >
                                        {isOpen ? <ChevronUp size={16} /> : <Eye size={16} />}
                                        <span className="sr-only">
                                            {isOpen ? "Ocultar vista previa" : "Ver vista previa"}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPdf(doc)}
                                        disabled={downloadingPdf === doc.uuid}
                                        className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-sunk hover:text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        title="Descargar PDF"
                                    >
                                        {downloadingPdf === doc.uuid
                                            ? <Loader2 size={16} className="animate-spin" />
                                            : <Download size={16} />
                                        }
                                        <span className="sr-only">Descargar PDF</span>
                                    </button>
                                </div>
                            </div>

                            {isOpen && (
                                <div id={panelId} className="border-t border-rule bg-sunk p-4">
                                    {previewLoading ? (
                                        <div className="flex items-center justify-center gap-2 py-6 text-ink-3">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span className="text-xs">Renderizando documento…</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="prose prose-sm prose-slate max-h-72 max-w-none overflow-y-auto text-xs [&_h2]:text-sm [&_h2]:font-bold [&_p]:my-1.5"
                                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </SectionCard>
    )
}
