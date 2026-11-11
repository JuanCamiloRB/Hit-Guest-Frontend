"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Home, Users, Calendar, MapPin, Download, Clock, FileText, Loader2, Mail, XCircle, RefreshCw } from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { normalizeApiError } from "@/lib/notify-error"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { isMainGuestCompleted, pendingGuestsCount, type CheckinPortalResponse, type PortalContractInfo } from "@/features/checkin/types/checkin"
import { resolveContractSigningState, isContractTransitional } from "@/features/checkin/lib/contract-signing"
import { completedEntryCopy, resolveCompletedEntryReason } from "@/features/checkin/lib/success-entry"
import { AccessInstructionsPanel } from "./AccessInstructionsPanel"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"

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
    const completedEntryReason = resolveCompletedEntryReason(
        searchParams.get("entry"),
        searchParams.get("guest_uuid"),
        portal.registeredGuests,
    )
    const completedCopy = completedEntryReason ? completedEntryCopy(completedEntryReason) : null
    const mainCompleted = isMainGuestCompleted(portal)
    const pendingGuests = Math.max(0, pendingGuestsCount(portal))
    const contractPending = searchParams.get("contract_pending") === "1"
    // TuFirma's `pending_signature` is intentionally NOT main-guest completion:
    // secondary guests stay locked until the webhook. The query flag describes
    // the response that just happened and must outrank any stale navigation cache.
    const isMainDone = !contractPending
        && (searchParams.get("main_done") === "true" || (mainCompleted && !portal.progress.isFullyCompleted))
    const hasPendingSecondaries = mainCompleted && pendingGuests > 0
    const welcomeHref = `/checkin/${reservationUuid}`

    const [documents, setDocuments] = useState<ReservationDocument[]>([])
    const [docsLoading, setDocsLoading] = useState(true)
    const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null)
    const [downloadingContract, setDownloadingContract] = useState(false)

    // Un solo objeto en vez de tres piezas sueltas (status/signedAt/url): el
    // estado que se muestra sale de los tres a la vez, y tenerlos separados dejaba
    // que se actualizaran de a uno y describieran un contrato que no existía.
    const [contract, setContract] = useState<PortalContractInfo | null>(portal.contract ?? null)
    // El sondeo se dio por vencido. No es un error: TuFirma se firma al ritmo de
    // una persona y puede tardar horas. Lo que no se puede hacer es dejar el
    // spinner girando para siempre fingiendo que sigue mirando.
    const [pollStalled, setPollStalled] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    // `signedContractUrl` es la ÚNICA señal válida de que el PDF se puede
    // descargar (ver `resolveContractSigningState`): el backend la publica
    // exactamente cuando `canDownload`, y la deja en null si no.
    const contractState = resolveContractSigningState(contract)
    const contractReady = contractState === "available"

    // El titular con TuFirma llega acá con su registro guardado pero SIN firmar:
    // el backend lo deja incompleto hasta el webhook (§3 del contrato), así que
    // este cierre NO puede titular "Completado" — eso hacía leer el flujo como
    // terminado sin firma (reporte 2026-08-21). El flag cubre el envío recién
    // hecho (el portal puede no reflejarlo todavía); el estado del portal cubre
    // la reapertura — pero solo para el TITULAR: la firma pendiente es suya, y
    // un acompañante con su registro completo no debe leer "falta tu firma".
    // Cuando el webhook llega, el sondeo existente actualiza `contract` y el
    // cierre pasa solo a verde.
    const viewerIsMain = portal.registeredGuests.some(
        (guest) => guest.uuid === searchParams.get("guest_uuid") && guest.isMain,
    )
    const awaitingSignature =
        (contractState === "awaiting_external" && (viewerIsMain || contractPending))
        || (contractPending && contractState === "awaiting_guest")
    // Fail closed on malformed legacy data: `slice()` on a non-string timestamp
    // would otherwise crash this screen immediately after a successful signature.
    const signedAt = typeof contract?.signedAt === "string" ? contract.signedAt : null

    useEffect(() => {
        let mounted = true
        checkinService.getReservationDocuments(reservationUuid, portal)
            .then(docs => { if (mounted) setDocuments(docs) })
            .catch(() => {})
            .finally(() => { if (mounted) setDocsLoading(false) })
        return () => { mounted = false }
    }, [reservationUuid, portal])

    /**
     * ¿Tiene sentido seguir mirando el portal?
     *
     * `isContractTransitional` cubre lo que puede cambiar solo: la firma externa
     * de TuFirma (webhook) y la generación del PDF firmado.
     *
     * El segundo término cubre una carrera real: `contract_pending=1` lo pone el
     * envío que ACABA de ocurrir —el backend respondió `pending_signature`— pero
     * el portal que renderizó esta página se pidió en el servidor y puede haber
     * salido antes de que ese estado se persistiera, devolviendo `not_started`.
     * Antes el sondeo se armaba solo mirando el estado, así que en esa ventana no
     * arrancaba nunca y —al no estar el estado en las dependencias— tampoco se
     * rearmaba después: el huésped se quedaba con el aviso de "falta firmar" y una
     * pantalla que ya no volvía a consultar nada.
     */
    const shouldPollContract =
        isContractTransitional(contractState)
        || (contractPending && contractState === "awaiting_guest")

    useEffect(() => {
        // `pollStalled` está en las dependencias a propósito: es lo que apaga el
        // sondeo cuando se agota el presupuesto Y lo que lo vuelve a encender
        // cuando el huésped pulsa "Actualizar", con un presupuesto nuevo.
        if (!shouldPollContract || pollStalled) return
        let active = true
        let elapsed = 0
        // Arranca corto porque el caso nativo se resuelve en segundos, y se abre
        // porque el caso de TuFirma depende de que una persona abra un correo.
        let interval = 8000
        const MAX_INTERVAL = 30_000
        const BUDGET = 10 * 60 * 1000
        let timer: ReturnType<typeof setTimeout>
        const tick = async () => {
            try {
                const p = await checkinService.getPortal(reservationUuid)
                if (!active) return
                if (p.contract) {
                    setContract(p.contract)
                    // Los documentos de la reserva cambian cuando el contrato
                    // firmado pasa a existir, no antes.
                    if (p.contract.signedContractUrl) {
                        checkinService.getReservationDocuments(reservationUuid, p)
                            .then(d => { if (active) setDocuments(d) })
                            .catch(() => {})
                        return
                    }
                }
            } catch {}
            elapsed += interval
            if (!active) return
            if (elapsed >= BUDGET) {
                // Se agotó el presupuesto y el contrato sigue sin resolverse. Con
                // TuFirma es lo esperable —se firma cuando la persona abre el
                // correo, no en diez minutos—, así que se deja de sondear y se le
                // dice, en vez de dejar un spinner girando indefinidamente sobre
                // un sondeo que ya había terminado en silencio.
                setPollStalled(true)
                return
            }
            interval = Math.min(interval * 1.5, MAX_INTERVAL)
            timer = setTimeout(tick, interval)
        }
        timer = setTimeout(tick, interval)
        return () => { active = false; clearTimeout(timer) }
    }, [reservationUuid, shouldPollContract, pollStalled])

    /**
     * Consulta manual tras agotarse el sondeo. Es el mismo GET del portal, pedido
     * por el huésped: lo único que puede hacer desde acá es preguntar de nuevo —
     * no existe un endpoint de reenvío que el huésped pueda llamar.
     */
    const handleRefreshContract = async () => {
        setRefreshing(true)
        try {
            const p = await checkinService.getPortal(reservationUuid)
            if (p.contract) setContract(p.contract)
            // Rearma el sondeo si sigue en un estado que puede cambiar solo.
            setPollStalled(false)
            if (p.contract?.signedContractUrl) {
                await checkinService.getReservationDocuments(reservationUuid, p)
                    .then(setDocuments)
                    .catch(() => {})
            }
        } catch {
            toast.error("No pudimos consultar el estado de tu contrato. Intenta de nuevo.")
        } finally {
            setRefreshing(false)
        }
    }

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
                <div className={`absolute inset-0 ${awaitingSignature ? "bg-warning" : "bg-success"} blur-3xl opacity-20 rounded-full`} />
                <div className={`w-24 h-24 rounded-full flex items-center justify-center relative z-10 ${awaitingSignature
                    ? "bg-warning"
                    : "bg-success"}`}
                >
                    {awaitingSignature
                        ? <Icon icon={Mail} size="4xl" className="text-white" />
                        : <Icon icon={CheckCircle2} size="4xl" className="text-white" />}
                </div>
            </div>

            <div className="space-y-3">
                <Heading level={1}>
                    {completedCopy?.title ?? (awaitingSignature
                        ? "Tu registro quedó guardado"
                        : isMainDone ? "¡Tu Registro Está Listo!" : "¡Check-in Completado!")}
                </Heading>
                <p className="text-ink-3 text-base max-w-75 mx-auto">
                    {completedCopy?.description ?? (awaitingSignature
                        ? "Tu check-in se completará cuando firmes el contrato. Te llegará un correo de TuFirma para hacerlo."
                        : isMainDone
                            ? "Los huéspedes acompañantes ya pueden iniciar su registro."
                            : "Tus datos y documentos han sido validados exitosamente. Ya estás un paso más cerca de tu estadía.")}
                </p>
            </div>

            {/* El envío acaba de responder `pending_signature` pero el portal todavía
                no lo refleja: se le dice al huésped lo que tiene que hacer sin
                esperar a que el estado se persista. Cuando el portal lo confirma,
                lo reemplaza la tarjeta de "esperando la firma" de abajo. */}
            {contractPending && contractState === "awaiting_guest" && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Icon icon={Mail} size="lg" className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-ink">Falta firmar el contrato</p>
                        <p className="text-xs text-ink-3 mt-0.5">
                            Recibirás un correo de TuFirma para firmar tu contrato de forma digital. Tu registro
                            ya quedó guardado.
                        </p>
                    </div>
                </div>
            )}

            {/* Contract ready → download the SIGNED PDF (with legal evidence page). */}
            {contractReady && (
                <div className="bg-success-sunk border border-success/20 rounded-xl p-4 w-full max-w-sm flex flex-col gap-3 text-left">
                    <div className="flex items-start gap-3">
                        <Icon icon={CheckCircle2} size="lg" className="text-success flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-success">Contrato firmado</p>
                            <p className="text-xs text-success mt-0.5">
                                Tu contrato firmado está listo{signedAt ? ` (${formatDate(signedAt.slice(0, 10))})` : ""}.
                            </p>
                        </div>
                    </div>
                    <Button type="button" size="lg"
                        onClick={handleDownloadSignedContract}
                        disabled={downloadingContract}
                        className="w-full flex items-center justify-center"
                    >
                        {downloadingContract
                            ? <Icon icon={Loader2} className="animate-spin" />
                            : <Icon icon={Download} />}
                        Descargar contrato firmado
                    </Button>
                </div>
            )}

            {/*
              * Contrato en curso. Los dos casos NO son el mismo y por eso se
              * redactan distinto: `awaiting_external` depende de que el huésped
              * abra su correo (acción suya, puede tardar horas), `finalizing`
              * depende del backend generando el PDF (segundos).
              *
              * Cuando el sondeo se agota, el spinner se cambia por un estado
              * quieto con consulta manual: seguir animando algo que ya dejó de
              * mirarse es mentirle al huésped.
              */}
            {isContractTransitional(contractState) && (
                <div className="bg-warning-sunk border border-warning/20 rounded-xl p-4 w-full max-w-sm flex flex-col gap-3 text-left">
                    <div className="flex items-start gap-3">
                        {pollStalled
                            ? <Icon icon={Clock} size="lg" className="text-warning flex-shrink-0 mt-0.5" />
                            : <Icon icon={Loader2} size="lg" className="text-warning flex-shrink-0 mt-0.5 animate-spin" />}
                        <div>
                            <p className="text-sm font-bold text-warning">
                                {contractState === "awaiting_external"
                                    ? "Falta tu firma en TuFirma"
                                    : "Procesando tu contrato…"}
                            </p>
                            <p className="text-xs text-warning mt-0.5">
                                {contractState === "awaiting_external"
                                    ? "Abre el correo de TuFirma y firma tu contrato. Si no lo ves, revisa la carpeta de spam."
                                    : "Estamos finalizando tu contrato firmado; podrás descargarlo en un momento."}
                            </p>
                        </div>
                    </div>
                    {pollStalled && (
                        <Button variant="outline-warning"
                            type="button"
                            onClick={handleRefreshContract}
                            disabled={refreshing}
                            className="w-full flex items-center justify-center"
                        >
                            {refreshing
                                ? <Icon icon={Loader2} size="sm" className="animate-spin" />
                                : <Icon icon={RefreshCw} size="sm" />}
                            Ya firmé, actualizar estado
                        </Button>
                    )}
                </div>
            )}

            {/*
              * Firma rechazada o fallida en TuFirma (SIGNER_REJECTED / SIGNER_FAILED).
              * Es terminal y el huésped no tiene reintento por su cuenta, pero antes
              * no se renderizaba nada para este estado: la pantalla decía "registro
              * completado" y el huésped se iba creyendo que estaba todo en orden.
              */}
            {contractState === "rejected" && (
                <div className="bg-danger-sunk border border-danger/20 rounded-xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Icon icon={XCircle} size="lg" className="text-danger flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-danger">Tu contrato no pudo firmarse</p>
                        <p className="text-xs text-danger mt-0.5">
                            La firma digital fue rechazada. Tus datos quedaron registrados, pero el
                            anfitrión debe reenviarte el contrato — contáctalo para completarlo.
                        </p>
                    </div>
                </div>
            )}

            {isMainDone && pendingGuests > 0 && (
                <div className="bg-warning-sunk border border-warning/30 rounded-xl p-4 w-full max-w-sm flex items-start gap-3 text-left">
                    <Icon icon={Clock} size="lg" className="text-warning flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-warning">
                            {pendingGuests} {pendingGuests === 1 ? "huésped pendiente" : "huéspedes pendientes"}
                        </p>
                        <p className="text-xs text-warning mt-0.5">
                            Los accesos de la propiedad estarán disponibles cuando todos completen su registro.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-rule rounded-xl p-4 w-full max-w-sm space-y-3 shadow-sm">
                <div className="flex items-center gap-3 text-left">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <Icon icon={MapPin} size="lg" className="text-primary" />
                    </div>
                    <div>
                        <Heading level={3} size="subsection">Tu alojamiento</Heading>
                        <p className="text-xs text-ink-3">{res.uuid.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="h-px bg-sunk" />
                <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="flex items-center gap-2">
                        <Icon icon={Calendar} size="sm" className="text-ink-3" />
                        <span className="text-xs text-ink-2">{formatDate(res.arrivalDate)} — {formatDate(res.departureDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <Icon icon={Users} size="sm" className="text-ink-3" />
                        <span className="text-xs text-ink-2">{res.totalGuestsAllowed} huéspedes</span>
                    </div>
                </div>
            </div>

            {mainCompleted && (
                <AccessInstructionsPanel portal={portal} unlocked={portal.progress.isFullyCompleted} />
            )}

            {docsLoading ? (
                <div className="bg-sunk/50 border border-rule p-4 rounded-xl flex items-center gap-3 w-full max-w-sm">
                    <Icon icon={Loader2} size="lg" className="animate-spin text-ink-3" />
                    <span className="text-xs text-ink-3">Cargando documentos...</span>
                </div>
            ) : documents.length > 0 ? (
                <div className="w-full max-w-sm space-y-2">
                    {documents.map((doc) => (
                        <div key={doc.uuid} className="bg-sunk/50 border border-rule p-4 rounded-xl flex items-center gap-4 text-left">
                            <div className="bg-primary/10 p-3 rounded-xl flex-shrink-0">
                                <Icon icon={FileText} size="lg" className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <Heading level={3} size="subsection" className="truncate">{doc.typeName}</Heading>
                                <p className="text-xs text-ink-3">Descarga tu copia aquí.</p>
                            </div>
                            <Button type="button" variant="link" size="inline"
                                onClick={() => handleDownloadPdf(doc.uuid)}
                                disabled={downloadingDoc === doc.uuid}
                                className="flex-shrink-0"
                            >
                                {downloadingDoc === doc.uuid ? (
                                    <Icon icon={Loader2} className="animate-spin" />
                                ) : (
                                    "Descargar"
                                )}
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-sunk/50 border border-rule p-4 rounded-xl flex items-center gap-4 text-left w-full max-w-sm">
                    <div className="bg-primary/10 p-3 rounded-xl">
                        <Icon icon={Download} size="xl" className="text-primary" />
                    </div>
                    <div className="flex-1">
                        <Heading level={3} size="subsection">
                            {awaitingSignature ? "Registro guardado" : "Check-in Completado"}
                        </Heading>
                        <p className="text-xs text-ink-3">No hay documentos disponibles para descargar.</p>
                    </div>
                </div>
            )}


            <div className="bg-sunk/50 border border-rule p-4 rounded-xl flex items-center gap-4 text-left w-full max-w-sm mt-2">
                <div className="bg-primary/10 p-3 rounded-xl flex-shrink-0">
                    <Icon icon={Home} size="xl" className="text-primary" />
                </div>
                <div>
                    <Heading level={3} size="subsection">Todo Listo</Heading>
                    <p className="text-xs text-ink-3">Recibirás también esta información por email antes de tu llegada.</p>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-rule/50 z-10 flex justify-center">
                <div className="w-full max-w-lg flex flex-col gap-2">
                    {hasPendingSecondaries && (
                        <Button asChild size="xl">
                            <Link href={welcomeHref} className="w-full">
                                <Icon icon={Users} size="lg" />
                                Ver inicio para acompañantes
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="outline" size="xl">
                        <Link
                            href={hasPendingSecondaries ? welcomeHref : "/"}
                            className="w-full"
                        >
                            {hasPendingSecondaries ? "Cerrar y volver al inicio" : "Cerrar"}
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
