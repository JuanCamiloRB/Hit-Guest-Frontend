"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, Upload, Loader2, CheckCircle2, XCircle, RotateCcw, FileText, Clock } from "lucide-react"
import { toast } from "sonner"
import { normalizeVerificationResult } from "@/features/checkin/lib/verification-result"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { CatalogService } from "@/features/auth/services/catalog-service"
import type { OCRResult, IdentifySessionData } from "@/features/checkin/types/checkin"
import { asCheckinError } from "@/features/checkin/lib/checkin-error"
import { diditCompletionAction } from "@/features/checkin/lib/didit-completion"
import type { VerificationResult } from "@didit-protocol/sdk-web"

interface VerifyScreenProps {
    reservationUuid: string
    guestUuid: string
    basePath: string
    isSecondary?: boolean
    /** Exact local draft owned by the route; avoids sharing main/secondary OCR edits. */
    formStorageKey?: string
    /** True when redirected back from Didit callback URL — checks localStorage for pending KYC */
    fromCallback?: boolean
    /**
     * Terminal Didit status from `?didit_error=` (declined / expired / abandoned…),
     * set by DiditCallbackClient when the session ends badly. Without it the guest
     * landed back here with no idea why the verification stopped.
     */
    diditError?: string
}

/** Terminal Didit session statuses → what the guest is actually told. */
const DIDIT_ERROR_MESSAGES: Record<string, string> = {
    declined: "Tu verificación fue rechazada. Puedes intentarlo de nuevo.",
    rejected: "Tu verificación fue rechazada. Puedes intentarlo de nuevo.",
    expired: "La verificación expiró. Inicia una nueva para continuar.",
    abandoned: "No completaste la verificación. Puedes retomarla cuando quieras.",
    failed: "La verificación no pudo completarse. Intenta de nuevo.",
}

/**
 * `kyc_session_failed`: el biométrico pasó pero abrir la validación de documento
 * falló. Es recuperable y hay que decir exactamente eso — reiniciar NO cuesta
 * repetir el reconocimiento facial. El mensaje se comparte entre las dos vías
 * que detectan el estado (sondeo del portal y consulta a /verify/result) para
 * que no puedan divergir.
 */
const KYC_RESTART_MESSAGE =
    "No pudimos abrir la validación de tu documento. Intenta de nuevo — no necesitas repetir el reconocimiento facial."

/**
 * `ocr_rejected`: a diferencia de un rechazo de Didit, el huésped puede
 * reintentar de inmediato con mejores fotos. Mandarlo al anfitrión sería un
 * callejón sin salida.
 */
const OCR_REJECTED_MESSAGE =
    "No pudimos leer bien tu documento. Intenta de nuevo con fotos más claras y buena luz."

/** How the guest can recover from a document/selfie verification error. */
type RetryScope = "selfie" | "documents" | "all" | "none"

/**
 * OCR / face-comparison errorType → recovery UX. `retry` decides which files we
 * keep: face failures only reset the selfie (documents are re-sent from cache);
 * document-quality failures reset the document photos; hard stops offer no retry.
 * `message` is a fallback — the backend's localized message is preferred when present.
 */
const DOC_ERROR_UI: Record<string, { retry: RetryScope; message: string }> = {
    FACE_MISMATCH:              { retry: "selfie",    message: "Tu selfie no coincide con el documento. Tómate otra foto." },
    NO_FACE_DETECTED:           { retry: "selfie",    message: "No detectamos un rostro. Asegúrate de tener buena iluminación y que tu cara esté centrada." },
    SERVICE_UNAVAILABLE:        { retry: "all",       message: "Servicio no disponible. Intenta de nuevo en un momento." },
    CRITICAL_FIELD_ERROR:       { retry: "documents", message: "No pudimos leer el documento. Toma una foto más clara." },
    LOW_QUALITY_IMAGE:          { retry: "documents", message: "La imagen del documento es de baja calidad. Toma una foto más clara." },
    DOCUMENT_NUMBER_UNREADABLE: { retry: "documents", message: "No pudimos leer el número del documento. Toma una foto más clara." },
    DUPLICATE_DOCUMENT:         { retry: "none",      message: "Este documento ya está registrado para otro huésped. Contacta al anfitrión." },
    EXPIRED_DOCUMENT:           { retry: "none",      message: "El documento está vencido. No es posible continuar el registro." },
    DOCUMENT_NUMBER_MISMATCH:   { retry: "none",      message: "El número del documento no coincide con el registrado. Contacta al anfitrión." },
    UNSUPPORTED_DOCUMENT_LAYOUT:{ retry: "documents", message: "Este formato de documento no es compatible con la validación automática. Usa tu pasaporte para continuar." },
}

export function VerifyScreen({
    reservationUuid,
    guestUuid,
    basePath,
    isSecondary = false,
    formStorageKey = `checkin-guest-form-${reservationUuid}`,
    fromCallback = false,
    diditError,
}: VerifyScreenProps) {
    const router = useRouter()
    const { load, saveRaw, clear } = useIdentifySession(reservationUuid)

    // Defer localStorage read to client-side to avoid SSR/hydration mismatch.
    // Server has no localStorage → renders null; client loads after mount.
    const [session, setSession] = useState<IdentifySessionData | null>(null)
    const [sessionLoaded, setSessionLoaded] = useState(false)

    const [verificationState, setVerificationState] = useState<"idle" | "verifying" | "polling" | "waiting_portal" | "ocr_confirm" | "failed" | "expired" | "stale">("idle")
    const [progress, setProgress] = useState(0)
    const [frontFile, setFrontFile] = useState<File | null>(null)
    const [backFile, setBackFile] = useState<File | null>(null)
    // Selfie for face comparison (v4.7). Cached alongside the documents so a
    // FACE_MISMATCH retry only re-shoots the selfie, never the document.
    const [selfieFile, setSelfieFile] = useState<File | null>(null)
    // Sub-step within the document_upload flow: capture documents first, selfie last.
    const [captureStep, setCaptureStep] = useState<"documents" | "selfie">("documents")
    // errorType from the last failed upload — drives the retry affordance.
    const [docErrorType, setDocErrorType] = useState<string | null>(null)
    const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
    // Stores the active Didit session step for copy/UX purposes
    const [diditStep, setDiditStep] = useState<"biometric" | "kyc">("biometric")
    // Current portal verification.status — used to display contextual message while polling
    const [portalVerifStatus, setPortalVerifStatus] = useState<string>("")
    // Identification number used in IdentifyScreen, stored via localStorage to drive mock routing
    const [identTrigger, setIdentTrigger] = useState<string>("")
    // Whether the selected document type requires a back image (false = single-sided like passport)
    const [requiresBackImage, setRequiresBackImage] = useState<boolean>(true)
    // Backend-provided (localized) reason the verification failed — shown on the failed screen.
    const [failureMessage, setFailureMessage] = useState<string | null>(null)

    // Edit state for OCR confirmation (includes expirationDate for identificationExpiryDate)
    const [editOcr, setEditOcr] = useState({
        firstName: "",
        lastName: "",
        documentNumber: "",
        dateOfBirth: "",
        expirationDate: "",
    })

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
    /** Token de la corrida de sondeo vigente — ver `startPortalPolling`. */
    const pollGenerationRef = useRef<object | null>(null)
    // Last Didit session URL we launched — the reconcile loop never re-opens it
    // (a consumed session returns 403) and uses it to detect when the backend hands
    // back a genuinely new session (e.g. the document step after the biometric).
    const lastLaunchedUrlRef = useRef<string | null>(null)

    const verification = session?.verification ?? null

    // Copy config per Didit step
    const diditCopy = {
        biometric: {
            title: "Verificación Facial",
            description: "Completa un reconocimiento facial rápido. Si ya estás en Didit con documentos válidos, no necesitas subir nada más.",
            button: "Iniciar Verificación Facial",
        },
        kyc: {
            title: "Verifica tu Documento",
            description: "Toma una foto de tu documento de identidad y una selfie para completar tu verificación.",
            button: "Iniciar Verificación de Documento",
        },
    } as const

    // Load identification type catalog to determine if back image is required.
    // identificationTypeId comes from the saved session; fallback to prefilledData
    // for sessions saved before this change was deployed.
    useEffect(() => {
        const catalogs = new CatalogService()
        catalogs.getIdentificationTypesV2().then(types => {
            if (types.length === 0) return
            const sessionData = load(guestUuid || undefined)
            const typeId =
                sessionData?.identificationTypeId ??
                (sessionData?.formSchema?.prefilledData?.identificationTypeId as number | undefined)
            if (typeId) {
                const match = types.find(t => t.id === Number(typeId))
                if (match) setRequiresBackImage(match.requiresBackImage)
            }
        }).catch(() => {
            // Fallback: keep requiresBackImage=true (show both fields by default)
        })
    }, [guestUuid]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load session from localStorage after mount (avoids SSR hydration mismatch).
    // Also: if this is a Didit callback redirect without guest_uuid in the URL,
    // recover it from the 'checkin-pending-didit' key and self-redirect.
    //
    // El setState síncrono acá es deliberado: localStorage no existe en el
    // servidor, así que leerlo en el render rompería la hidratación.
    useEffect(() => {
        if (fromCallback && !guestUuid) {
            // Didit redirected to /verify?from_didit_callback=1 without guest_uuid.
            // Recover guest context from the pending-didit key set by launchDiditSession.
            try {
                const pending = JSON.parse(localStorage.getItem('checkin-pending-didit') || 'null')
                if (pending?.reservationUuid === reservationUuid && pending?.guestUuid) {
                    router.replace(
                        `${basePath}/verify?from_didit_callback=1&guest_uuid=${pending.guestUuid}`
                    )
                    return // wait for re-render with guestUuid populated
                }
            } catch {}
        }

        // The URL identifies the guest. Loading only by reservation here could
        // hydrate this page with another guest's last provider directive.
        const loadedSession = load(guestUuid || undefined)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession(loadedSession)

        setSessionLoaded(true)
    }, [fromCallback, guestUuid, reservationUuid, basePath, router, load])

    // Mismo motivo que el efecto de arriba: lee localStorage y traduce los
    // parámetros de la URL del callback a estado inicial de la pantalla.
    useEffect(() => {
        if (!sessionLoaded) return
        if (!guestUuid) {
            router.replace(`${basePath}/identify`)
        }
        // Load identification trigger for mock routing
        try {
            const triggerKey = `checkin-ident-trigger-${reservationUuid}-${guestUuid}`
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIdentTrigger(localStorage.getItem(triggerKey) || '')
        } catch {}
        // La etapa la decide el backend; una sesión reanudada puede ser KYC.
        if (verification && verification.type === 'session') {
            setDiditStep(verification.sessionType)
        }
        // A callback remount and a direct reopen both lose the in-memory ref. The
        // persisted marker is proof that THIS browser already launched a Didit
        // session for this reservation+guest, so both entries must reconcile with
        // `/verify/result` instead of rendering the stale directive from /identify.
        let shouldResumePolling = fromCallback
        try {
            const pending = JSON.parse(localStorage.getItem("checkin-pending-didit") || "null")
            if (
                pending?.reservationUuid === reservationUuid
                && pending?.guestUuid === guestUuid
                && typeof pending?.launchedUrl === "string"
            ) {
                lastLaunchedUrlRef.current = pending.launchedUrl
                if (pending.step === "biometric" || pending.step === "kyc") {
                    setDiditStep(pending.step)
                }
                shouldResumePolling = true
            } else if (fromCallback && verification?.type === "session") {
                // `fromCallback` means this locally persisted session was just
                // consumed. This fallback also protects Safari/private-mode
                // callbacks where persisting the pending key was unavailable.
                lastLaunchedUrlRef.current = verification.url
            }
        } catch {
            if (fromCallback && verification?.type === "session") {
                lastLaunchedUrlRef.current = verification.url
            }
        }
        // A terminal Didit status wins over polling: the session is over, there is
        // nothing left for the portal to confirm. Show the guest WHY it stopped —
        // the callback has been appending `?didit_error=` all along and nothing
        // read it, so a declined session looked identical to a fresh screen.
        if (diditError) {
            setFailureMessage(
                DIDIT_ERROR_MESSAGES[diditError.toLowerCase()]
                ?? "La verificación no pudo completarse. Intenta de nuevo.",
            )
            setVerificationState("failed")
        } else if (shouldResumePolling) {
            // Redirected back from Didit or reopened after launching it — reconcile
            // immediately against the backend-owned verification state.
            startPortalPolling()
        }
        return () => {
            pollGenerationRef.current = null
            if (pollingRef.current) clearTimeout(pollingRef.current)
            import('@didit-protocol/sdk-web').then(({ DiditSdk }) => {
                if (DiditSdk.shared.isPresented) DiditSdk.shared.destroy()
            }).catch(() => {})
        }
        // A propósito no se incluye `startPortalPolling`: se recrea en cada
        // render, así que incluirlo reiniciaría el sondeo continuamente — que es
        // justo lo que este efecto arranca. `diditError`/`fromCallback` vienen de
        // la URL y no cambian sin navegar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guestUuid, basePath, router, sessionLoaded])

    // Se declaran como `function` a propósito: `startPortalPolling` y
    // `launchDiditSession` se llaman mutuamente (el sondeo puede abrir la sesión
    // de documento, y el `onComplete` de esa sesión vuelve a sondear). Con `const`,
    // una de las dos referencia siempre a la otra antes de su declaración —
    // funcionaba solo porque ambas se invocan de forma asíncrona. Las
    // declaraciones de función se elevan y quitan esa dependencia del orden.
    // ── Portal Polling (v4.3) ──
    // After Didit completes, /verify/result drives the verification state with
    // exponential backoff. The broad portal read runs independently only to
    // detect reservation availability and provide contextual copy.
    function startPortalPolling() {
        setVerificationState("waiting_portal")
        setProgress(50)
        let currentInterval = 2000
        // Keep feedback responsive after returning from Didit. The backend owns
        // business staleness (`isStale`); this cap only limits how long the guest
        // waits between fresh observations of that state.
        const MAX_INTERVAL = 5000
        if (pollingRef.current) clearTimeout(pollingRef.current)

        /**
         * Marca de generación del sondeo.
         *
         * Limpiar `pollingRef` no alcanza: si el desmontaje (o un relanzamiento)
         * ocurre mientras `poll()` está esperando una respuesta, el timer que se
         * cancela es el VIEJO — la petición en vuelo termina después, llama a
         * `scheduleNext()` y programa uno NUEVO que ya nadie va a limpiar. Ese
         * sondeo zombi sigue pegándole a la API y escribiendo estado sobre una
         * pantalla desmontada. Cada arranque toma su propio token y cualquier
         * continuación comprueba que siga siendo la vigente antes de actuar.
         */
        const generation = {}
        pollGenerationRef.current = generation
        const isCurrent = () => pollGenerationRef.current === generation

        // Portal is a broader fallback projection and may be much slower. Keep at
        // most one request in flight. It only guards reservation availability and
        // supplies status copy; /verify/result is the documented verification
        // state source, so the two projections cannot race to choose navigation.
        let portalReadInFlight = false

        const stopPolling = () => {
            if (isCurrent()) pollGenerationRef.current = null
        }

        /** Applies the same backend state machine regardless of which read saw it first. */
        const applyOutcome = (
            outcome: ReturnType<typeof normalizeVerificationResult>,
        ): boolean => {
            if (!isCurrent()) return true

            if (outcome.status === "kyc_required" && outcome.kycUrl) {
                // The same URL is the consumed/current session, not a new KYC step.
                if (outcome.kycUrl === lastLaunchedUrlRef.current) return false
                toast.info("Necesitamos validar tu documento de identidad.")
                void launchDiditSession(outcome.kycUrl, "kyc")
                return true
            }
            if (outcome.status === "verified") {
                setProgress(100)
                handleVerificationSuccess()
                return true
            }
            if (outcome.status === "restart_required") {
                stopPolling()
                setFailureMessage(KYC_RESTART_MESSAGE)
                setVerificationState("failed")
                return true
            }
            if (outcome.status === "stale") {
                stopPolling()
                setVerificationState("stale")
                return true
            }
            if (outcome.status === "contact_challenge") {
                stopPolling()
                router.replace(`${basePath}/contact-challenge?guest_uuid=${guestUuid}`)
                return true
            }
            if (outcome.status === "failed") {
                stopPolling()
                const msg = outcome.retryable || outcome.failureReason === "ocr_rejected"
                    ? OCR_REJECTED_MESSAGE
                    : outcome.failureReason === "expired"
                        ? "Tu documento está vencido."
                        : outcome.failureReason === "fail"
                            ? "La verificación no pudo completarse. Intenta de nuevo."
                            : "La verificación fue rechazada. Contacta al anfitrión si necesitas ayuda."
                setFailureMessage(msg)
                setVerificationState("failed")
                toast.error(msg)
                return true
            }
            return false
        }

        const observePortal = async () => {
            try {
                const portal = await checkinService.getPortal(reservationUuid)
                if (!isCurrent()) return
                if (portal.portalStatus) {
                    stopPolling()
                    setVerificationState("failed")
                    setFailureMessage(portal.message || "Esta reserva ya no está disponible. Contacta al anfitrión.")
                    return
                }
                const verif = portal.registeredGuests.find(g => g.uuid === guestUuid)?.verification
                if (!verif) return
                setPortalVerifStatus(verif.status)
            } catch {
                // A failed broad projection must not delay or cancel the lightweight read.
            }
        }

        const observeVerificationResult = async () => {
            try {
                const result = await checkinService.checkVerificationResult(
                    reservationUuid, guestUuid, identTrigger,
                )
                if (!isCurrent()) return
                applyOutcome(result)
            } catch (raw: unknown) {
                if (!isCurrent()) return
                const error = asCheckinError(raw)
                // Contract: 404 means the reservation or the guest-reservation
                // link does not exist. It is not a source-specific capability
                // signal and cannot recover by polling the broad projection.
                if (error.status === 404) {
                    stopPolling()
                    setFailureMessage(error.message || "No encontramos esta verificación. Contacta al anfitrión.")
                    setVerificationState("failed")
                }
            }
        }

        const poll = async () => {
            // Start the broad portal observation detached and deduplicated. The
            // lightweight endpoint controls the cadence, so an initial `pending`
            // response is checked again in 2s even if GET /checkin is still slow.
            if (!portalReadInFlight) {
                portalReadInFlight = true
                void observePortal().finally(() => { portalReadInFlight = false })
            }
            await observeVerificationResult()
            if (isCurrent()) scheduleNext()
        }

        const scheduleNext = () => {
            if (!isCurrent()) return
            pollingRef.current = setTimeout(poll, currentInterval)
            currentInterval = Math.min(currentInterval * 1.5, MAX_INTERVAL)
        }

        // The SDK/callback has already told us the biometric session ended. Read
        // backend state now; only subsequent non-terminal observations back off.
        pollingRef.current = setTimeout(poll, 0)
    }

    function handleVerificationSuccess() {
        pollGenerationRef.current = null
        if (pollingRef.current) clearTimeout(pollingRef.current)
        try {
            const pending = JSON.parse(localStorage.getItem("checkin-pending-didit") || "null")
            if (pending?.reservationUuid === reservationUuid && pending?.guestUuid === guestUuid) {
                localStorage.removeItem("checkin-pending-didit")
            }
        } catch {}
        toast.success("Identidad verificada exitosamente")
        setTimeout(() => router.push(`${basePath}/guest?guest_uuid=${guestUuid}`), 600)
    }

    async function launchDiditSession(url: string, step: "biometric" | "kyc") {
        pollGenerationRef.current = null
        if (pollingRef.current) clearTimeout(pollingRef.current)
        // Remember the session we're launching so the reconcile loop never re-opens
        // a consumed session (which Didit rejects with 403).
        lastLaunchedUrlRef.current = url
        setDiditStep(step)
        setVerificationState("polling")
        // `/identify` is only the initial directive. When polling advances from
        // biometric to KYC, persist the new backend-provided directive so a cancel
        // or reload never falls back to the old facial-verification copy/URL.
        if (session) {
            const nextSession: IdentifySessionData = {
                ...session,
                verification: { type: "session", sessionType: step, url },
                timestamp: Date.now(),
            }
            setSession(nextSession)
            saveRaw(nextSession)
        }
        // Persist context so the Didit callback page can redirect back correctly
        try {
            localStorage.setItem('checkin-pending-didit', JSON.stringify({
                reservationUuid,
                guestUuid,
                basePath,
                step,
                launchedUrl: url,
                startedAt: Date.now(),
            }))
        } catch {}
        try {
            const { DiditSdk } = await import('@didit-protocol/sdk-web')
            DiditSdk.shared.onComplete = (result: VerificationResult) => {
                // Close the Didit modal as soon as the session finishes. After completion
                // the SDK can navigate its iframe to the return/callback URL — which 404s
                // (backend domain redirect) and would flash a "404 NOT FOUND" inside the
                // modal. Destroying it here shows our own "Procesando..." screen instead.
                try { if (DiditSdk.shared.isPresented) DiditSdk.shared.destroy() } catch {}
                const action = diditCompletionAction(result)
                if (action === "reconcile") {
                    // `completed` is the SDK success signal. Its session.status can still
                    // be `Pending` (the SDK even defaults to it when Didit omits status),
                    // so it must not gate reconciliation. The backend remains the source
                    // of truth and decides verified / KYC required / rejected.
                    startPortalPolling()
                } else if (action === "cancelled") {
                    // The session remains reusable, but it is no longer waiting for
                    // a completed Didit flow. Remove the polling marker; the idle
                    // screen keeps the persisted canonical directive and lets the
                    // guest resume it explicitly.
                    try {
                        const pending = JSON.parse(localStorage.getItem("checkin-pending-didit") || "null")
                        if (pending?.reservationUuid === reservationUuid && pending?.guestUuid === guestUuid) {
                            localStorage.removeItem("checkin-pending-didit")
                        }
                    } catch {}
                    setVerificationState('idle')
                } else if (action === "expired") {
                    setVerificationState('expired')
                } else {
                    setVerificationState("failed")
                    toast.error("La verificación no fue exitosa. Intenta de nuevo.")
                }
            }
            DiditSdk.shared.startVerification({ url })
        } catch {
            toast.error("Error al iniciar la verificación")
            setVerificationState("idle")
        }
    }

    const handleSessionVerification = () => {
        if (!verification || verification.type !== "session") return
        launchDiditSession(verification.url, verification.sessionType)
    }

    const MAX_FILE_SIZE_MB = 10
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

    /** Documents captured — validate their size, then advance to the selfie step. */
    const goToSelfie = () => {
        if (!frontFile) {
            toast.error("La foto frontal del documento es obligatoria")
            return
        }
        if (requiresBackImage && !backFile) {
            toast.error("La foto del reverso del documento es obligatoria")
            return
        }
        if (frontFile.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`La foto frontal no puede superar ${MAX_FILE_SIZE_MB}MB`)
            return
        }
        if (backFile && backFile.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`La foto del reverso no puede superar ${MAX_FILE_SIZE_MB}MB`)
            return
        }
        setFailureMessage(null)
        setDocErrorType(null)
        setCaptureStep("selfie")
    }

    /**
     * Routes a failed upload to the right recovery, keyed by errorType. The backend
     * deletes ALL uploaded files on any failure, so a retry always re-sends the
     * cached documents — for face failures the guest only retakes the selfie.
     */
    const handleUploadError = (raw: unknown) => {
        const e = asCheckinError(raw)
        // `errorType` is the OCR contract; some validation responses expose the
        // same discriminator as `code`. Accept both while backend versions roll.
        const errorType = e.errorType ?? (e.code && DOC_ERROR_UI[e.code] ? e.code : undefined)
        const ui = errorType ? DOC_ERROR_UI[errorType] : undefined
        // This new validation exists specifically to tell the guest to switch to
        // a passport. A generic backend 422 message must not erase that recovery.
        const message = errorType === "UNSUPPORTED_DOCUMENT_LAYOUT"
            ? ui!.message
            : e.message || ui?.message || "No pudimos verificar tu identidad. Intenta de nuevo con fotos más claras."
        setDocErrorType(errorType ?? null)
        setFailureMessage(message)

        const scope: RetryScope = ui?.retry ?? "all"
        if (scope === "none") {
            // Hard stop — no retry; the failed screen shows a contact-support message.
            setVerificationState("failed")
            return
        }
        // Retryable: stay in the capture view (idle) so cached files survive.
        if (scope === "selfie") {
            setSelfieFile(null)
            setCaptureStep("selfie")
        } else if (scope === "documents") {
            setFrontFile(null)
            setBackFile(null)
            setSelfieFile(null)
            setCaptureStep("documents")
        } else {
            // "all" (e.g. SERVICE_UNAVAILABLE) — keep every file, let them resubmit.
            setCaptureStep("selfie")
        }
        setVerificationState("idle")
        toast.error(message)
    }

    const handleDocumentUpload = async () => {
        if (!frontFile) {
            toast.error("La foto frontal del documento es obligatoria")
            return
        }
        // Defensa adicional por si el catálogo termina de cargar o el estado se
        // restaura mientras el huésped ya está en el paso de la selfie. El
        // backend exige back_image para todo documento que no sea de una cara.
        if (requiresBackImage && !backFile) {
            toast.error("La foto del reverso del documento es obligatoria")
            setCaptureStep("documents")
            return
        }
        if (!selfieFile) {
            toast.error("La selfie es obligatoria")
            return
        }
        if (frontFile.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`La foto frontal no puede superar ${MAX_FILE_SIZE_MB}MB`)
            return
        }
        if (backFile && backFile.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`La foto del reverso no puede superar ${MAX_FILE_SIZE_MB}MB`)
            return
        }
        if (selfieFile.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`La selfie no puede superar ${MAX_FILE_SIZE_MB}MB`)
            return
        }
        setFailureMessage(null)
        setDocErrorType(null)
        setVerificationState("verifying")
        try {
            const formData = new FormData()
            formData.append("front_image", frontFile) // snake_case — multipart has no auto-conversion
            if (backFile) formData.append("back_image", backFile) // snake_case — multipart has no auto-conversion
            formData.append("selfie_image", selfieFile) // NEW (v4.7): face comparison vs. document photo

            const ocr = await checkinService.uploadDocumentImages(reservationUuid, guestUuid, formData)

            setOcrResult(ocr)
            // Backend may split data across extractedData and formSchema.prefilledData
            // Aunque el contrato declara `extractedData`, una respuesta 2xx sin
            // ese bloque no debe convertir una aprobación ya persistida en un
            // error de JavaScript. `prefilledData` sigue siendo una fuente válida
            // y el formulario permite confirmar los datos extraídos.
            const d = ocr.extractedData ?? {}
            const p = (ocr.formSchema?.prefilledData ?? {}) as Record<string, unknown>
            setEditOcr({
                firstName: d.name || d.firstName || String(p.name || ""),
                lastName: d.lastname || d.lastName || String(p.lastname || ""),
                documentNumber: d.identificationNumber || d.documentNumber || String(p.identificationNumber || ""),
                dateOfBirth: d.dateOfBirth || String(p.dateOfBirth || ""),
                expirationDate: d.expirationDate || String(p.expirationDate || ""),
            })

            // Contrato síncrono de Textract: un 200 significa que la identidad ya
            // quedó aprobada y persistida. No hay webhook posterior que esperar.
            // Consultar el portal acá añadía una carrera: el primer intento podía
            // verse como pendiente/error aunque el backend ya lo hubiera aprobado,
            // y el segundo pasaba porque para entonces el portal sí lo reflejaba.
            setVerificationState("ocr_confirm")
            toast.success("Documento analizado correctamente")
        } catch (e: unknown) {
            handleUploadError(e)
        }
    }

    const handleOcrConfirm = () => {
        // Overwrite guest form in localStorage with fresh OCR + prefilledData.
        // We intentionally do NOT merge with stale stored values so the OCR data wins cleanly.
        const prefilledExtras = (ocrResult?.formSchema?.prefilledData ?? {}) as Record<string, unknown>

        const merged = {
            ...prefilledExtras,
            // User-confirmed (possibly edited) OCR fields always override prefilledData
            name: editOcr.firstName,
            lastname: editOcr.lastName,
            identificationNumber: editOcr.documentNumber,
            dateOfBirth: editOcr.dateOfBirth,
            ...(editOcr.expirationDate ? { identificationExpiryDate: editOcr.expirationDate } : {}),
        }
        localStorage.setItem(formStorageKey, JSON.stringify(merged))
        try {
            const ocrDataKey = `checkin-ocr-data-${reservationUuid}-${guestUuid}`
            localStorage.setItem(ocrDataKey, JSON.stringify(editOcr))
        } catch {}

        router.push(`${basePath}/guest?guest_uuid=${guestUuid}`)
    }

    const handleRetry = () => {
        setVerificationState("idle")
        setProgress(0)
        setFrontFile(null)
        setBackFile(null)
        setSelfieFile(null)
        setOcrResult(null)
        setDocErrorType(null)
        setFailureMessage(null)
        setCaptureStep("documents")
    }

    /**
     * Breaks the expired-Didit-session loop: wipes the stored identify session
     * (which holds the stale Didit URL) and any pending-didit context, then sends
     * the guest back to /identify to request a fresh verification session.
     */
    const handleResetVerification = () => {
        pollGenerationRef.current = null
        if (pollingRef.current) clearTimeout(pollingRef.current)
        lastLaunchedUrlRef.current = null
        try {
            clear(guestUuid || undefined)
            localStorage.removeItem('checkin-pending-didit')
        } catch {}
        toast.info("Reiniciando tu verificación...")
        router.replace(`${basePath}/identify`)
    }

    const portalStatusMessages: Record<string, string> = {
        not_started: "Iniciando verificación...",
        in_progress: "Verificando tu identidad...",
        in_review: "Tu verificación está siendo revisada por nuestro equipo",
    }

    // ── Session not yet loaded from localStorage (initial server/client sync) ──
    if (!sessionLoaded) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 size={32} className="animate-spin text-brand-purple" />
            </div>
        )
    }

    // ── Loading states (verifying, polling, waiting_portal) ──
    if (verificationState === "verifying" || verificationState === "polling" || verificationState === "waiting_portal") {
        const loadingTitle =
            verificationState === "verifying" ? "Analizando documento..." :
            verificationState === "waiting_portal" ? "Procesando verificación..." :
            diditStep === "biometric" ? "Procesando verificación facial..." : "Procesando verificación de documento..."
        const loadingSubtitle =
            verificationState === "verifying" ? "Extrayendo datos con Inteligencia Artificial..." :
            verificationState === "waiting_portal" && portalVerifStatus !== "pending" ? (portalStatusMessages[portalVerifStatus] || "El servidor está confirmando tu identidad con Didit...") :
            diditStep === "biometric" ? "Completando reconocimiento facial con Didit..." : "Completando verificación de documento con Didit..."
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in zoom-in-95 duration-500 pb-24 text-center px-4">
                <div className="w-full max-w-sm">
                    <ProgressBar currentStep={2} totalSteps={isSecondary ? 3 : 5} />
                </div>
                <div className="relative mt-8">
                    <div className="absolute inset-0 bg-brand-purple blur-3xl opacity-20 rounded-full" />
                    <div className="bg-brand-purple/10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl shadow-brand-purple/10 relative z-10 border border-brand-purple/20">
                        {progress >= 100
                            ? <CheckCircle2 size={40} className="text-green-500" />
                            : <Loader2 size={40} className="text-brand-purple animate-spin" />
                        }
                    </div>
                </div>
                <div className="space-y-3 w-full max-w-xs">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">{loadingTitle}</h2>
                    {verificationState === "waiting_portal" && portalVerifStatus === "pending" ? (
                        <p className="text-slate-500 text-sm">
                            <span className="md:hidden">Estamos confirmando tu verificación. Mantén esta pantalla abierta.</span>
                            <span className="hidden md:inline">Completa la verificación en la ventana abierta.</span>
                        </p>
                    ) : (
                        <p className="text-slate-500 text-sm">{loadingSubtitle}</p>
                    )}
                    {verificationState === "polling" && (
                        <>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-6">
                                <div className="h-full bg-brand-purple transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-xs text-slate-400 font-medium text-right mt-1">{progress}%</p>
                        </>
                    )}
                </div>
            </div>
        )
    }


    // ── OCR Confirm State ──
    if (verificationState === "ocr_confirm") {
        return (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                <ProgressBar currentStep={2} totalSteps={isSecondary ? 3 : 5} />

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                        Confirma tus datos
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Hemos extraído esta información de tu documento. Corrige cualquier error si es necesario.
                    </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <FileText size={20} className="text-brand-purple" />
                        <h2 className="font-bold text-slate-800">Datos Extraídos</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Nombres</label>
                            <input type="text" value={editOcr.firstName} onChange={e => setEditOcr({...editOcr, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Apellidos</label>
                            <input type="text" value={editOcr.lastName} onChange={e => setEditOcr({...editOcr, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Número de Documento</label>
                            <input type="text" value={editOcr.documentNumber} onChange={e => setEditOcr({...editOcr, documentNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Fecha de Nacimiento</label>
                            <input type="date" value={editOcr.dateOfBirth} onChange={e => setEditOcr({...editOcr, dateOfBirth: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                        </div>
                        {editOcr.expirationDate !== undefined && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Vencimiento del Documento</label>
                                <input type="date" value={editOcr.expirationDate} onChange={e => setEditOcr({...editOcr, expirationDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center gap-3">
                    <div className="w-full max-w-lg flex gap-3">
                        <button onClick={handleRetry} className="flex-1 h-14 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-lg transition-all active:scale-[0.98]">
                            Reintentar
                        </button>
                        <button onClick={handleOcrConfirm} className="flex-[2] flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98]">
                            <CheckCircle2 size={20} /> Continuar
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Espera huérfana según el backend ──
    if (verificationState === "stale") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 pb-24 text-center px-4 animate-in fade-in duration-500">
                <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center border border-amber-100">
                    <Clock size={40} className="text-amber-400" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">No pudimos confirmar la verificación</h2>
                    <p className="text-slate-500 text-sm max-w-xs">
                        La verificación quedó pendiente más tiempo del esperado. Contacta al anfitrión para que pueda revisar tu caso.
                    </p>
                </div>
                <Link
                    href={basePath}
                    className="flex items-center gap-2 h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all active:scale-[0.98]"
                >
                    <ArrowLeft size={18} />
                    Volver al inicio
                </Link>
            </div>
        )
    }

    // ── Expired session state ──
    // The Didit session backing the URL expired (created >7 days ago). Resetting
    // re-runs /identify so the backend can hand back a fresh session URL.
    if (verificationState === "expired") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 pb-24 text-center px-4 animate-in fade-in duration-500">
                <div className="bg-amber-50 w-24 h-24 rounded-full flex items-center justify-center border border-amber-100">
                    <RotateCcw size={40} className="text-amber-400" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">Tu sesión de verificación expiró</h2>
                    <p className="text-slate-500 text-sm max-w-xs">
                        La verificación caduca después de un tiempo. Reiníciala para obtener una nueva.
                        Si el problema persiste, contacta al anfitrión.
                    </p>
                </div>
                <button
                    onClick={handleResetVerification}
                    className="flex items-center gap-2 h-12 px-6 bg-brand-purple text-white rounded-xl font-semibold transition-all active:scale-[0.98]"
                >
                    <RotateCcw size={18} />
                    Reiniciar verificación
                </button>
            </div>
        )
    }

    // ── Failed state ──
    if (verificationState === "failed") {
        // Non-retryable OCR/face errors (expired, duplicate, number mismatch): no
        // retry button — the guest can't self-recover, so point them to the host.
        const isHardStop = docErrorType != null && DOC_ERROR_UI[docErrorType]?.retry === "none"
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 pb-24 text-center px-4 animate-in fade-in duration-500">
                <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center border border-red-100">
                    <XCircle size={40} className="text-red-400" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">Verificación no exitosa</h2>
                    <p className="text-slate-500 text-sm max-w-xs">
                        {failureMessage || "No pudimos verificar tu identidad. Por favor intenta de nuevo con fotos más claras."}
                    </p>
                </div>
                {isHardStop ? (
                    <Link
                        href={basePath}
                        className="flex items-center gap-2 h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all active:scale-[0.98]"
                    >
                        <ArrowLeft size={18} />
                        Volver al inicio
                    </Link>
                ) : (
                    <button
                        onClick={verification?.type === "session" ? handleResetVerification : handleRetry}
                        className="flex items-center gap-2 h-12 px-6 bg-brand-purple text-white rounded-xl font-semibold transition-all active:scale-[0.98]"
                    >
                        <RotateCcw size={18} />
                        Intentar de nuevo
                    </button>
                )}
            </div>
        )
    }

    // ── No session data fallback ──
    if (!verification) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
                <p className="text-slate-500 text-sm">Sesión expirada. Vuelve a identificarte.</p>
                <Link href={`${basePath}/identify`} className="text-brand-purple font-semibold underline">
                    Volver al inicio
                </Link>
            </div>
        )
    }

    // ── Idle: render based on verification.type from backend (G3) ──
    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={2} totalSteps={isSecondary ? 3 : 5} />

            <div className="flex items-center justify-between">
                {/* Back goes to the welcome hub, not /identify — re-identifying an existing
                    guest hits "document already registered" and lands on an empty form. */}
                <Link href={basePath} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {isSecondary ? "Paso 2 de 4" : "Paso 3 de 6"}
                </div>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    Verifica tu Identidad
                </h1>
                <p className="text-slate-500 text-sm">
                    {verification.type === "session"
                        ? "Completa la verificación de identidad directamente aquí con Didit. Solo toma un minuto."
                        : "Sube una foto de tu documento y una selfie para verificar tu identidad."}
                </p>
            </div>

            {/* session: Didit — copy based on the backend's canonical sessionType */}
            {verification.type === "session" && (() => {
                const copy = diditCopy[verification.sessionType]
                return (
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm text-center space-y-6">
                        <div className="bg-slate-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto border border-slate-100 shadow-inner">
                            <span className="text-2xl font-black text-slate-800 tracking-tighter">Didit.</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-slate-800">{copy.title}</h3>
                            <p className="text-sm text-slate-500">{copy.description}</p>
                        </div>
                        <p className="text-xs text-slate-400">
                            El resultado se detecta automáticamente al completar la verificación.
                        </p>
                        <button
                            type="button"
                            onClick={handleResetVerification}
                            className="text-xs text-slate-400 underline hover:text-brand-purple transition-colors"
                        >
                            ¿La ventana aparece como &quot;sesión expirada&quot;? Reinicia tu verificación
                        </button>
                    </div>
                )
            })()}

            {/* document_upload: two steps — documents first, selfie last (G3 + v4.7 face) */}
            {verification.type === "document_upload" && (
                <div className="space-y-4">
                    {/* A retryable error keeps us in the capture view; show why inline. */}
                    {failureMessage && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <div className="flex items-start gap-2">
                                <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                                <span>{failureMessage}</span>
                            </div>
                            {docErrorType === "UNSUPPORTED_DOCUMENT_LAYOUT" && (
                                <Link
                                    href={`${basePath}/identify`}
                                    className="mt-2 ml-6 inline-flex font-semibold underline underline-offset-2"
                                >
                                    Cambiar el tipo de documento a pasaporte
                                </Link>
                            )}
                        </div>
                    )}

                    {captureStep === "documents" ? (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                            {/* Front photo */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    Foto Frontal<span className="text-red-400 ml-0.5">*</span>
                                </label>
                                {frontFile ? (
                                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={18} className="text-green-500" />
                                            <span className="text-sm text-slate-700 truncate max-w-[180px]">{frontFile.name}</span>
                                        </div>
                                        <button onClick={() => setFrontFile(null)} className="text-xs text-red-400 font-medium">Quitar</button>
                                    </div>
                                ) : (
                                    <label className="w-full h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all text-slate-500 cursor-pointer group">
                                        <div className="bg-slate-100 p-3 rounded-full group-hover:bg-brand-purple/10 group-hover:text-brand-purple transition-colors">
                                            <Camera size={24} />
                                        </div>
                                        <span className="text-sm font-medium">Tomar foto o seleccionar</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="sr-only"
                                            onChange={e => setFrontFile(e.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Back photo — hidden for single-sided documents (passport, etc.) */}
                            {requiresBackImage ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">
                                        Foto Reverso<span className="text-red-400 ml-0.5">*</span>
                                    </label>
                                    {backFile ? (
                                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={18} className="text-green-500" />
                                                <span className="text-sm text-slate-700 truncate max-w-[180px]">{backFile.name}</span>
                                            </div>
                                            <button onClick={() => setBackFile(null)} className="text-xs text-red-400 font-medium">Quitar</button>
                                        </div>
                                    ) : (
                                        <label className="w-full h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all text-slate-500 cursor-pointer group">
                                            <div className="bg-slate-100 p-3 rounded-full group-hover:bg-brand-purple/10 group-hover:text-brand-purple transition-colors">
                                                <Upload size={24} />
                                            </div>
                                            <span className="text-sm font-medium">Subir reverso</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="sr-only"
                                                onChange={e => setBackFile(e.target.files?.[0] ?? null)}
                                            />
                                        </label>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 text-center bg-slate-50 rounded-xl py-3 px-4">
                                    Este documento solo requiere la imagen frontal.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-slate-700">
                                    Selfie<span className="text-red-400 ml-0.5">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setFailureMessage(null); setDocErrorType(null); setCaptureStep("documents") }}
                                    className="text-xs font-medium text-slate-400 hover:text-brand-purple transition-colors"
                                >
                                    ← Documentos
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 -mt-1">
                                Tómate una selfie para confirmar que eres la persona del documento.
                            </p>

                            {selfieFile ? (
                                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={18} className="text-green-500" />
                                        <span className="text-sm text-slate-700 truncate max-w-[180px]">{selfieFile.name}</span>
                                    </div>
                                    <button onClick={() => setSelfieFile(null)} className="text-xs text-red-400 font-medium">Quitar</button>
                                </div>
                            ) : (
                                <label className="w-full h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all text-slate-500 cursor-pointer group">
                                    <div className="bg-slate-100 p-3 rounded-full group-hover:bg-brand-purple/10 group-hover:text-brand-purple transition-colors">
                                        <Camera size={24} />
                                    </div>
                                    <span className="text-sm font-medium">Tomar selfie</span>
                                    {/* capture="user" opens the front camera on mobile; desktop falls back to a file picker */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="user"
                                        className="sr-only"
                                        onChange={e => setSelfieFile(e.target.files?.[0] ?? null)}
                                    />
                                </label>
                            )}

                            <ul className="text-xs text-slate-500 space-y-1.5 bg-slate-50 rounded-xl p-3">
                                <li>· Mira directamente a la cámara</li>
                                <li>· Asegúrate de tener buena iluminación, sin sombras</li>
                                <li>· Sin lentes de sol ni gorras</li>
                                <li>· Tu rostro debe estar centrado y visible completo</li>
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    {verification.type === "session" ? (
                        <button
                            onClick={handleSessionVerification}
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98]"
                        >
                            {diditCopy[verification.sessionType].button}
                        </button>
                    ) : captureStep === "documents" ? (
                        <button
                            onClick={goToSelfie}
                            disabled={!frontFile || (requiresBackImage && !backFile)}
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Continuar
                        </button>
                    ) : (
                        <button
                            onClick={handleDocumentUpload}
                            disabled={!selfieFile}
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Analizar Documento
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
