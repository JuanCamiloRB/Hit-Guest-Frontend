"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Home, Users, Calendar, MapPin, Download, Clock, FileText, Loader2, Mail, XCircle } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { normalizeApiError } from "@/lib/notify-error"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { isMainGuestCompleted, pendingGuestsCount, type CheckinPortalResponse } from "@/features/checkin/types/checkin"
import { AccessInstructionsPanel } from "./AccessInstructionsPanel"

interface ReservationDocument {
    uuid: string
    typeName: string
    renderedHtml: string
}

interface SuccessScreenProps {
    portal: CheckinPortalResponse
    reservationUuid: string
}

export function SuccessScreen({ portal, reservationUuid }: SuccessScreenProps) {
    const res = portal.reservation;
    const searchParams = useSearchParams()
    const mainCompleted = isMainGuestCompleted(portal)
    const pendingGuests = Math.max(0, pendingGuestsCount(portal))
    const isMainDone = searchParams.get("main_done") === "true" || (mainCompleted && !portal.progress.isFullyCompleted)
    const contractPending = searchParams.get("contract_pending") === "1"
    const hasPendingSecondaries = mainCompleted && pendingGuests > 0
    const welcomeHref = `/checkin/${reservationUuid}`

    const [documents, setDocuments] = useState<ReservationDocument[]>([])
    const [docsLoading, setDocsLoading] = useState(true)
    const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null)
    const [downloadingContract, setDownloadingContract] = useState(false)

    const hasContract = !!portal.contract?.signingProvider
    const [contractStatus, setContractStatus] = useState<string | null>(portal.contract?.status ?? null)
    const [signedAt, setSignedAt] = useState<string | null>(portal.contract?.signedAt ?? null)
    const [signedUrlReady, setSignedUrlReady] = useState<boolean>(!!portal.contract?.signedContractUrl)
    // `signedContractUrl` es la ÚNICA señal válida de que el PDF se puede
    // descargar: el backend la publica exactamente cuando `canDownload`, y la deja
    // en null si no.
    //
    // Antes esto también aceptaba `status === "signed"` y `hasNativeSignature`, que
    // se ponen en true en cuanto el titular firma — ANTES de completar el check-in.
    // Un acompañante que llegaba a esta pantalla en esa ventana veía el botón de
    // descarga sobre una URL que el backend todavía no habilitaba, y el archivo
    // fallaba. Esperar `signedContractUrl` no retrasa el caso normal: con proveedor
    // síncrono aparece junto con el `complete` del titular.
    const contractReady = signedUrlReady

    useEffect(() => {
        let mounted = true
        checkinService.getReservationDocuments(reservationUuid, portal)
            .then(docs => { if (mounted) setDocuments(docs) })
            .catch(() => {})
            .finally(() => { if (mounted) setDocsLoading(false) })
        return () => { mounted = false }
    }, [reservationUuid, portal])

    // Poll the portal while the contract is in a transitional state (tufirma "pending"
    // waiting on the external signature, or hitguest "signed" before "completed"),
    // until it reaches "completed" — then the signed PDF becomes downloadable.
    useEffect(() => {
        if (!hasContract) return
        if (signedUrlReady) return // already downloadable — nothing to wait for
        if (contractStatus !== "pending" && contractStatus !== "signed") return
        let active = true
        let elapsed = 0
        const INTERVAL = 8000
        const TIMEOUT = 10 * 60 * 1000
        let timer: ReturnType<typeof setTimeout>
        const tick = async () => {
            try {
                const p = await checkinService.getPortal(reservationUuid)
                const c = p.contract
                if (active && c) {
                    setContractStatus(c.status)
                    if (c.signedAt) setSignedAt(c.signedAt)
                    if (c.signedContractUrl) setSignedUrlReady(true)
                    if (c.status === "completed") {
                        checkinService.getReservationDocuments(reservationUuid, p)
                            .then(d => { if (active) setDocuments(d) }).catch(() => {})
                        return
                    }
                }
            } catch {}
            elapsed += INTERVAL
            if (active && elapsed < TIMEOUT) timer = setTimeout(tick, INTERVAL)
        }
        timer = setTimeout(tick, INTERVAL)
        return () => { active = false; clearTimeout(timer) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservationUuid, hasContract])

    const handleDownloadPdf = async (docUuid: string) => {
        setDownloadingDoc(docUuid)
        try {
            await checkinService.openDocumentPdf(reservationUuid, docUuid)
        } catch {
            toast.error("No se pudo descargar el PDF")
        } finally {
            setDownloadingDoc(null)
        }
    }

    /**
     * El contrato firmado ya no se abre navegando a la URL.
     *
     * `signedContractUrl` garantiza que el backend habilitó la descarga, pero NO
     * que el PDF se pueda generar: §4 devuelve un 422 en JSON cuando la
     * configuración del contrato cambió desde que se firmó (el drift que el
     * backend dejó como gap vigente). Navegando, el huésped terminaba viendo el
     * JSON crudo en una pestaña en blanco, sin saber a quién recurrir.
     */
    const handleDownloadSignedContract = async () => {
        setDownloadingContract(true)
        try {
            await checkinService.openSignedContract(reservationUuid)
        } catch (error) {
            const { status, message } = normalizeApiError(error)
            toast.error(
                status === 422
                    ? message || "Tu contrato firmado necesita regenerarse. Contacta al anfitrión."
                    : "No pudimos abrir tu contrato firmado. Intenta de nuevo en un momento.",
            )
        } finally {
            setDownloadingContract(false)
        }
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + "T12:00:00")
        return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 animate-in zoom-in-95 duration-700 pb-24 text-center px-4">
            <ProgressBar currentStep={5} totalSteps={5} isSuccess />

            <div className="relative mt-4">
                <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 rounded-full" />
                <div className="bg-gradient-to-tr from-green-400 to-green-500 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 relative z-10">
                    <CheckCircle2 size={48} className="text-white" />
                </div>
            </div>

            <div className="space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    {isMainDone ? "¡Tu Registro Está Listo!" : "¡Check-in Completado!"}
                </h1>
                <p className="text-slate-500 text-base max-w-[300px] mx-auto">
                    {isMainDone
                        ? "Los huéspedes acompañantes ya pueden iniciar su registro."
                        : "Tus datos y documentos han sido validados exitosamente. Ya estás un paso más cerca de tu estadía."}
                </p>
            </div>

            {contractPending && !contractReady && contractStatus !== "pending" && (
                <div className="bg-brand-purple/5 border border-brand-purple/15 rounded-2xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Mail size={18} className="text-brand-purple flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-slate-800">Falta firmar el contrato</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Recibirás un correo de TuFirma para firmar tu contrato de forma digital. Tu registro
                            ya quedó guardado.
                        </p>
                    </div>
                </div>
            )}

            {/* Contract ready → download the SIGNED PDF (with legal evidence page). */}
            {contractReady && (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4 w-full max-w-sm flex flex-col gap-3 text-left">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-green-800">Contrato firmado</p>
                            <p className="text-xs text-green-700 mt-0.5">
                                Tu contrato firmado está listo{signedAt ? ` (${formatDate(signedAt.slice(0, 10))})` : ""}.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDownloadSignedContract}
                        disabled={downloadingContract}
                        className="w-full flex items-center justify-center gap-2 h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {downloadingContract
                            ? <Loader2 size={16} className="animate-spin" />
                            : <Download size={16} />}
                        Descargar contrato firmado
                    </button>
                </div>
            )}

            {/* Contract still processing (tufirma "pending" / hitguest "signed") → spinner. */}
            {hasContract && !contractReady && (contractStatus === "pending" || contractStatus === "signed") && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Loader2 size={18} className="text-amber-500 flex-shrink-0 mt-0.5 animate-spin" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">Procesando tu contrato…</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            {contractStatus === "pending"
                                ? "Esperando la firma en TuFirma. Te avisaremos cuando esté lista para descargar."
                                : "Estamos finalizando tu contrato firmado; podrás descargarlo en un momento."}
                        </p>
                    </div>
                </div>
            )}

            {/*
              * Firma rechazada o fallida en TuFirma (SIGNER_REJECTED / SIGNER_FAILED).
              * Es terminal y el huésped no tiene reintento por su cuenta, pero antes
              * no se renderizaba nada para este estado: la pantalla decía "registro
              * completado" y el huésped se iba creyendo que estaba todo en orden.
              */}
            {hasContract && contractStatus === "rejected" && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-800">Tu contrato no pudo firmarse</p>
                        <p className="text-xs text-red-700 mt-0.5">
                            La firma digital fue rechazada. Tus datos quedaron registrados, pero el
                            anfitrión debe reenviarte el contrato — contáctalo para completarlo.
                        </p>
                    </div>
                </div>
            )}

            {isMainDone && pendingGuests > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Clock size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-800">
                            {pendingGuests} {pendingGuests === 1 ? "huésped pendiente" : "huéspedes pendientes"}
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            Los accesos de la propiedad estarán disponibles cuando todos completen su registro.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-100 rounded-2xl p-4 w-full max-w-sm space-y-3 shadow-sm">
                <div className="flex items-center gap-3 text-left">
                    <div className="bg-brand-purple/10 p-2 rounded-xl">
                        <MapPin size={18} className="text-brand-purple" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Tu alojamiento</h3>
                        <p className="text-xs text-slate-500">{res.uuid.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-600">{formatDate(res.arrivalDate)} — {formatDate(res.departureDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-600">{res.totalGuestsAllowed} huéspedes</span>
                    </div>
                </div>
            </div>

            {mainCompleted && (
                <AccessInstructionsPanel portal={portal} unlocked={portal.progress.isFullyCompleted} />
            )}

            {docsLoading ? (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-3 w-full max-w-sm">
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                    <span className="text-xs text-slate-400">Cargando documentos...</span>
                </div>
            ) : documents.length > 0 ? (
                <div className="w-full max-w-sm space-y-2">
                    {documents.map((doc) => (
                        <div key={doc.uuid} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4 text-left">
                            <div className="bg-brand-purple/10 p-3 rounded-xl flex-shrink-0">
                                <FileText className="text-brand-purple" size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 text-sm truncate">{doc.typeName}</h3>
                                <p className="text-xs text-slate-500">Descarga tu copia aquí.</p>
                            </div>
                            <button
                                onClick={() => handleDownloadPdf(doc.uuid)}
                                disabled={downloadingDoc === doc.uuid}
                                className="text-sm font-bold text-brand-purple hover:underline disabled:opacity-50 flex-shrink-0"
                            >
                                {downloadingDoc === doc.uuid ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    "Descargar"
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4 text-left w-full max-w-sm">
                    <div className="bg-brand-purple/10 p-3 rounded-xl">
                        <Download className="text-brand-purple" size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 text-sm">Check-in Completado</h3>
                        <p className="text-xs text-slate-500">No hay documentos disponibles para descargar.</p>
                    </div>
                </div>
            )}


            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-4 text-left w-full max-w-sm mt-2">
                <div className="bg-brand-purple/10 p-3 rounded-xl flex-shrink-0">
                    <Home className="text-brand-purple" size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Todo Listo</h3>
                    <p className="text-xs text-slate-500">Recibirás también esta información por email antes de tu llegada.</p>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg flex flex-col gap-2">
                    {hasPendingSecondaries && (
                        <Link href={welcomeHref} className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-base shadow-lg transition-all active:scale-[0.98]">
                            <Users size={18} />
                            Ver inicio para acompañantes
                        </Link>
                    )}
                    <Link
                        href={hasPendingSecondaries ? welcomeHref : "/"}
                        className="w-full flex items-center justify-center gap-2 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-base shadow-lg transition-all active:scale-[0.98]"
                    >
                        {hasPendingSecondaries ? "Cerrar y volver al inicio" : "Cerrar"}
                    </Link>
                </div>
            </div>
        </div>
    )
}
