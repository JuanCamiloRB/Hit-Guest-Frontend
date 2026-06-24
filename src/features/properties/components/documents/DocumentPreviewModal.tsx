"use client"

import { useMemo, useState } from "react"
import { Loader2, Download, Sparkles, FlaskConical } from "lucide-react"
import { notifyError } from "@/lib/notify-error"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ApiError } from "@/types/api"
import { reservationsService } from "@/features/reservations/services/reservations-service"
import type { Reservation } from "@/types"
import { propertyDocumentService } from "../../services/property-document-service"
import { normalizeShortcodes } from "../../types/document"

interface DocumentPreviewModalProps {
    onClose: () => void
    propertyUuid: string
    documentUuid: string | null
    content: string
    shortcodes: string[]
}

// Sample values used for the offline (client-side) preview.
const SAMPLE_VALUES: Record<string, string> = {
    guest_first_name: "María",
    guest_last_name: "García",
    guest_identification_type: "Pasaporte",
    guest_identification_number: "AB1234567",
    checkin_date: "2026-08-01",
    checkout_date: "2026-08-04",
    checkin_time: "15:00",
    checkout_time: "11:00",
    total_nights: "3",
    total_guests: "2",
    total_price: "$450.000 COP",
    listing_name: "Suite Junior",
    property_name: "Villa Azul",
    property_address: "Calle 10 #5-23, Cartagena",
}

function substituteSample(html: string): string {
    return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => {
        return SAMPLE_VALUES[key] ?? `{{${key}}}`
    })
}

type Mode = "sample" | "real"

/**
 * Mounted only while open (parent guards with conditional render), so no
 * open-sync effect is needed.
 */
export function DocumentPreviewModal({
    onClose,
    propertyUuid,
    documentUuid,
    content,
    shortcodes,
}: DocumentPreviewModalProps) {
    const [mode, setMode] = useState<Mode>("sample")
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [reservationsLoaded, setReservationsLoaded] = useState(false)
    const [loadingReservations, setLoadingReservations] = useState(false)
    const [selectedReservation, setSelectedReservation] = useState<string>("")
    const [rendering, setRendering] = useState(false)
    const [renderedHtml, setRenderedHtml] = useState<string>("")
    const [downloadingPdf, setDownloadingPdf] = useState(false)

    // Normalize any human labels ({{ Nombre de la propiedad }}) to real keys first,
    // so sample substitution works even if the stored content uses labels.
    const sampleHtml = useMemo(() => substituteSample(normalizeShortcodes(content)), [content])

    // Lazy-load reservations for the property the first time the user opens "real" mode.
    const loadReservations = () => {
        if (reservationsLoaded || loadingReservations) return
        setLoadingReservations(true)
        reservationsService
            .list()
            .then((all) => {
                const forProperty = all.filter((r) => r.propertyId === propertyUuid)
                setReservations(forProperty.length > 0 ? forProperty : all)
            })
            .catch(() => setReservations([]))
            .finally(() => {
                setReservationsLoaded(true)
                setLoadingReservations(false)
            })
    }

    const switchToReal = () => {
        setMode("real")
        loadReservations()
    }

    const handleRender = async (reservationUuid: string) => {
        if (!documentUuid) return
        setRendering(true)
        setRenderedHtml("")
        try {
            const html = await propertyDocumentService.render(reservationUuid, documentUuid)
            setRenderedHtml(html)
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) {
                notifyError(err, "El documento no pertenece a la propiedad de esta reserva")
            } else {
                notifyError(err, "No se pudo generar la vista previa")
            }
        } finally {
            setRendering(false)
        }
    }

    const handleDownloadPdf = async () => {
        if (!documentUuid || !selectedReservation) return
        setDownloadingPdf(true)
        try {
            await propertyDocumentService.openPdf(selectedReservation, documentUuid)
        } catch (err) {
            notifyError(err, "No se pudo descargar el PDF")
        } finally {
            setDownloadingPdf(false)
        }
    }

    const previewHtml = mode === "sample" ? sampleHtml : renderedHtml

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vista previa del documento</DialogTitle>
                    <DialogDescription>
                        Revisa cómo se verá el documento con las variables reemplazadas.
                    </DialogDescription>
                </DialogHeader>

                {/* Mode switch */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMode("sample")}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                            mode === "sample"
                                ? "border-[var(--color-brand-purple)]/30 bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)]"
                                : "border-slate-200 text-slate-500 hover:bg-slate-50",
                        )}
                    >
                        <FlaskConical size={14} /> Datos de ejemplo
                    </button>
                    <button
                        type="button"
                        onClick={switchToReal}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                            mode === "real"
                                ? "border-[var(--color-brand-purple)]/30 bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)]"
                                : "border-slate-200 text-slate-500 hover:bg-slate-50",
                        )}
                    >
                        <Sparkles size={14} /> Reserva real
                    </button>
                </div>

                {/* Real mode: reservation picker */}
                {mode === "real" && (
                    <div className="space-y-2">
                        {!documentUuid ? (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                Guarda el documento primero para previsualizarlo con una reserva real.
                            </p>
                        ) : loadingReservations ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                                <Loader2 size={16} className="animate-spin" /> Cargando reservas...
                            </div>
                        ) : reservations.length === 0 ? (
                            <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                No hay reservas disponibles para previsualizar.
                            </p>
                        ) : (
                            <Select
                                value={selectedReservation}
                                onValueChange={(v) => {
                                    setSelectedReservation(v)
                                    handleRender(v)
                                }}
                            >
                                <SelectTrigger className="bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Selecciona una reserva de prueba" />
                                </SelectTrigger>
                                <SelectContent>
                                    {reservations.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.guestName} · {r.unitName ?? r.propertyName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                )}

                {/* Rendered document */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 min-h-[240px]">
                    {rendering ? (
                        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                            <Loader2 size={20} className="animate-spin" /> Generando vista previa...
                        </div>
                    ) : previewHtml ? (
                        <div
                            className={cn(
                                "text-sm text-slate-700 leading-relaxed",
                                "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2",
                                "[&_p]:my-2 [&_strong]:font-bold",
                                "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
                                "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
                            )}
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    ) : (
                        <p className="text-center text-sm text-slate-400 py-16">
                            {mode === "real"
                                ? "Selecciona una reserva para ver el documento renderizado."
                                : "El documento está vacío."}
                        </p>
                    )}
                </div>

                {/* PDF download (real mode only) */}
                {mode === "real" && documentUuid && selectedReservation && (
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDownloadPdf}
                            disabled={downloadingPdf}
                            className="gap-1.5"
                        >
                            {downloadingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            Descargar PDF
                        </Button>
                    </div>
                )}

                {shortcodes.length > 0 && mode === "sample" && (
                    <p className="text-[11px] text-slate-400">
                        Esta vista usa datos de ejemplo. Para ver datos reales selecciona &quot;Reserva real&quot;.
                    </p>
                )}
            </DialogContent>
        </Dialog>
    )
}
