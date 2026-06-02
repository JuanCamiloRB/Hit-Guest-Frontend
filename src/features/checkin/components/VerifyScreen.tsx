"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, Upload, Loader2, CheckCircle2, XCircle, RotateCcw, FileText } from "lucide-react"
import { toast } from "sonner"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import type { OCRResult } from "@/features/checkin/types/checkin"

interface VerifyScreenProps {
    reservationUuid: string
    guestUuid: string
    basePath: string
    isSecondary?: boolean
    /** True when redirected back from Didit callback URL — checks localStorage for pending KYC */
    fromCallback?: boolean
}

export function VerifyScreen({ reservationUuid, guestUuid, basePath, isSecondary = false, fromCallback = false }: VerifyScreenProps) {
    const router = useRouter()
    const { load } = useIdentifySession(reservationUuid)

    const [verificationState, setVerificationState] = useState<"idle" | "verifying" | "polling" | "waiting_portal" | "ocr_confirm" | "failed">("idle")
    const [progress, setProgress] = useState(0)
    const [frontFile, setFrontFile] = useState<File | null>(null)
    const [backFile, setBackFile] = useState<File | null>(null)
    const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
    // Stores the active Didit session step for copy/UX purposes
    const [diditStep, setDiditStep] = useState<"biometric" | "kyc">("biometric")
    // Current portal verification.status — used to display contextual message while polling
    const [portalVerifStatus, setPortalVerifStatus] = useState<string>("")
    // Identification number used in IdentifyScreen, stored via localStorage to drive mock routing
    const [identTrigger, setIdentTrigger] = useState<string>("")

    // Edit state for OCR confirmation (includes expirationDate for identificationExpiryDate)
    const [editOcr, setEditOcr] = useState({
        firstName: "",
        lastName: "",
        documentNumber: "",
        dateOfBirth: "",
        expirationDate: "",
    })

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const session = load()
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

    useEffect(() => {
        if (!guestUuid) {
            router.replace(`${basePath}/identify`)
        }
        // If this guest already completed document upload previously, skip this step
        try {
            if (verification && verification.type === 'document_upload') {
                const verificationDoneKey = `checkin-verification-done-${reservationUuid}-${guestUuid}`
                const already = localStorage.getItem(verificationDoneKey) === 'true'
                if (already) {
                    router.replace(`${basePath}/guest?guest_uuid=${guestUuid}`)
                }
            }
        } catch {}
        // Load identification trigger for mock routing
        try {
            const triggerKey = `checkin-ident-trigger-${reservationUuid}-${guestUuid}`
            setIdentTrigger(localStorage.getItem(triggerKey) || '')
        } catch {}
        // Set initial Didit step — backend doesn't send subtype, always starts as biometric
        if (verification && verification.type === 'session') {
            setDiditStep(verification.subtype ?? 'biometric')
        }
        // If redirected back from Didit callback (mobile), start portal polling immediately
        if (fromCallback) {
            startPortalPolling()
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
            import('@didit-protocol/sdk-web').then(({ DiditSdk }) => {
                if (DiditSdk.shared.isPresented) DiditSdk.shared.destroy()
            }).catch(() => {})
        }
    }, [guestUuid, basePath, router])

    // ── Portal Polling (v4.2) ──
    // After Didit completes (via SDK onComplete or callback redirect), poll GET portal
    // every 3s watching registeredGuests[guestUuid].verification.currentStep:
    //   "form"     → backend processed webhook, guest verified → go to form
    //   "rejected" → verification rejected → show error
    //   else       → keep waiting (pending/in_progress/in_review)
    const startPortalPolling = () => {
        setVerificationState("waiting_portal")
        setProgress(50)
        let elapsed = 0
        const INTERVAL_MS = 3000
        const TIMEOUT_MS = 10 * 60 * 1000
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = setInterval(async () => {
            elapsed += INTERVAL_MS
            if (elapsed >= TIMEOUT_MS) {
                clearInterval(pollingRef.current!)
                setVerificationState("failed")
                toast.error("Tiempo de espera agotado. Contacta al anfitrión si necesitas ayuda.")
                return
            }
            try {
                const portal = await checkinService.getPortal(reservationUuid)
                const guest = portal.registeredGuests.find(g => g.uuid === guestUuid)
                const verif = guest?.verification
                if (!verif) return
                setPortalVerifStatus(verif.status)
                if (verif.currentStep === "form") {
                    clearInterval(pollingRef.current!)
                    setProgress(100)
                    handleVerificationSuccess()
                } else if (verif.currentStep === "rejected") {
                    clearInterval(pollingRef.current!)
                    setVerificationState("failed")
                    const msg = verif.status === "expired"
                        ? "Tu documento está vencido."
                        : verif.status === "fail"
                        ? "La verificación no pudo completarse. Intenta de nuevo."
                        : "La verificación fue rechazada. Contacta al anfitrión si necesitas ayuda."
                    toast.error(msg)
                }
                // else: currentStep = "verification" — keep polling
            } catch {
                // Network error — keep polling silently
            }
        }, INTERVAL_MS)
    }

    const handleVerificationSuccess = () => {
        try {
            const verificationDoneKey = `checkin-verification-done-${reservationUuid}-${guestUuid}`
            localStorage.setItem(verificationDoneKey, 'true')
        } catch {}
        toast.success("Identidad verificada exitosamente")
        setTimeout(() => router.push(`${basePath}/guest?guest_uuid=${guestUuid}`), 600)
    }

    const launchDiditSession = async (url: string, step: "biometric" | "kyc") => {
        setDiditStep(step)
        setVerificationState("polling")
        // Persist context so the Didit callback page can redirect back correctly
        try {
            localStorage.setItem('checkin-pending-didit', JSON.stringify({
                reservationUuid,
                guestUuid,
                basePath,
                step,
                startedAt: Date.now(),
            }))
        } catch {}
        try {
            const { DiditSdk } = await import('@didit-protocol/sdk-web')
            DiditSdk.shared.onComplete = (result: any) => {
                if (result.type === 'completed' && result.session?.status === 'Approved') {
                    // Didit session approved — poll portal until backend processes the webhook
                    // (verification.currentStep will change to "form" when ready)
                    startPortalPolling()
                } else if (result.type === 'cancelled') {
                    setVerificationState('idle')
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
        // Backend always sends biometric session first — subtype defaults to "biometric"
        launchDiditSession(verification.url, verification.subtype ?? 'biometric')
    }

    const MAX_FILE_SIZE_MB = 10
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

    const handleDocumentUpload = async () => {
        if (!frontFile) {
            toast.error("La foto frontal del documento es obligatoria")
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
        setVerificationState("verifying")
        try {
            const formData = new FormData()
            formData.append("front_image", frontFile) // snake_case — multipart has no auto-conversion
            if (backFile) formData.append("back_image", backFile) // snake_case — multipart has no auto-conversion

            const ocr = await checkinService.uploadDocumentImages(reservationUuid, guestUuid, formData)
            
            setOcrResult(ocr)
            setEditOcr({
                firstName: ocr.extractedData.firstName || "",
                lastName: ocr.extractedData.lastName || "",
                documentNumber: ocr.extractedData.documentNumber || "",
                dateOfBirth: ocr.extractedData.dateOfBirth || "",
                expirationDate: ocr.extractedData.expirationDate || "",
            })
            setVerificationState("ocr_confirm")
            toast.success("Documento analizado correctamente")
        } catch (e: any) {
            toast.error(e.message || "Error al subir las imágenes")
            setVerificationState("failed")
        }
    }

    const handleOcrConfirm = () => {
        // Persist OCR data to localStorage so GuestFormScreen can pre-fill fields.
        // Also saves identificationExpiryDate from the OCR expirationDate.
        const formKey = `checkin-guest-form-${reservationUuid}`
        const rawForm = localStorage.getItem(formKey)
        const currentForm = rawForm ? JSON.parse(rawForm) : {}

        const merged = {
            ...currentForm,
            name: editOcr.firstName,
            lastname: editOcr.lastName,
            identificationNumber: editOcr.documentNumber,
            dateOfBirth: editOcr.dateOfBirth,
            ...(editOcr.expirationDate ? { identificationExpiryDate: editOcr.expirationDate } : {}),
        }
        localStorage.setItem(formKey, JSON.stringify(merged))
        try {
            const verificationDoneKey = `checkin-verification-done-${reservationUuid}-${guestUuid}`
            const ocrDataKey = `checkin-ocr-data-${reservationUuid}-${guestUuid}`
            localStorage.setItem(verificationDoneKey, 'true')
            localStorage.setItem(ocrDataKey, JSON.stringify(editOcr))
        } catch {}

        router.push(`${basePath}/guest?guest_uuid=${guestUuid}`)
    }

    const handleRetry = () => {
        setVerificationState("idle")
        setProgress(0)
        setFrontFile(null)
        setBackFile(null)
        setOcrResult(null)
        try {
            const verificationDoneKey = `checkin-verification-done-${reservationUuid}-${guestUuid}`
            localStorage.removeItem(verificationDoneKey)
        } catch {}
    }

    const portalStatusMessages: Record<string, string> = {
        not_started: "Iniciando verificación...",
        pending: "Completa la verificación en la ventana abierta",
        in_progress: "Verificando tu identidad...",
        in_review: "Tu verificación está siendo revisada por nuestro equipo",
    }

    // ── Loading states (verifying, polling, waiting_portal) ──
    if (verificationState === "verifying" || verificationState === "polling" || verificationState === "waiting_portal") {
        const loadingTitle =
            verificationState === "verifying" ? "Analizando documento..." :
            verificationState === "waiting_portal" ? "Procesando verificación..." :
            diditStep === "biometric" ? "Procesando verificación facial..." : "Procesando verificación de documento..."
        const loadingSubtitle =
            verificationState === "verifying" ? "Extrayendo datos con Inteligencia Artificial..." :
            verificationState === "waiting_portal" ? (portalStatusMessages[portalVerifStatus] || "El servidor está confirmando tu identidad con Didit...") :
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
                    <p className="text-slate-500 text-sm">{loadingSubtitle}</p>
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

    // ── Failed state ──
    if (verificationState === "failed") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 pb-24 text-center px-4 animate-in fade-in duration-500">
                <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center border border-red-100">
                    <XCircle size={40} className="text-red-400" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">Verificación no exitosa</h2>
                    <p className="text-slate-500 text-sm max-w-xs">
                        No pudimos verificar tu identidad. Por favor intenta de nuevo con fotos más claras.
                    </p>
                </div>
                <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 h-12 px-6 bg-brand-purple text-white rounded-xl font-semibold transition-all active:scale-[0.98]"
                >
                    <RotateCcw size={18} />
                    Intentar de nuevo
                </button>
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
                <Link href={`${basePath}/identify`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
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
                        : "Sube una foto de tu documento para extraer tus datos automáticamente."}
                </p>
            </div>

            {/* session: Didit — copy based on subtype (biometric vs kyc), defaults to biometric */}
            {verification.type === "session" && (() => {
                const copy = diditCopy[verification.subtype ?? 'biometric']
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
                    </div>
                )
            })()}

            {/* document_upload: file inputs (G3) */}
            {verification.type === "document_upload" && (
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

                    {/* Back photo */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">
                            Foto Reverso <span className="text-slate-400 text-xs">(Opcional)</span>
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
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    {verification.type === "session" ? (
                        <button
                            onClick={handleSessionVerification}
                            className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98]"
                        >
                            {diditCopy[verification.subtype ?? 'biometric'].button}
                        </button>
                    ) : (
                        <button
                            onClick={handleDocumentUpload}
                            disabled={!frontFile}
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
