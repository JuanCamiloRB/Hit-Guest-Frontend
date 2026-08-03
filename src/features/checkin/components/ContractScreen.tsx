"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, FileText, ChevronDown, ChevronUp, Mail, PenLine } from "lucide-react"
import { toast } from "sonner"
import { normalizeApiError, notifyError } from "@/lib/notify-error"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { clearVerificationToken } from "@/features/checkin/lib/verification-token"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { SignaturePad } from "@/features/checkin/components/SignaturePad"
import { GuaranteeCardForm } from "@/features/checkin/components/GuaranteeCardForm"
import type {
    GuestFormData,
    CompleteMainGuestPayload,
    CompleteSecondaryGuestPayload,
    SigningProvider,
    GuaranteeStatus,
} from "@/features/checkin/types/checkin"

interface RenderedDocument {
    /** The agreement's real uuid, or the literal "guarantee" — the guarantee
     *  text has no uuid of its own (backend plan §4.2), it's never signed as
     *  a standalone document. */
    uuid: string
    typeName: string
    renderedHtml: string
}

export function ContractScreen({ reservationUuid, basePath }: { reservationUuid: string, basePath: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const guestUuid = searchParams.get("guest_uuid") || ""
    const { load: loadSession } = useIdentifySession(reservationUuid)

    const [isLoading, setIsLoading] = useState(true)
    // The contract signature is MAIN-GUEST ONLY (/main/sign is reservation-level).
    // Keep this unresolved until backend/session identifies the guest; guessing
    // "main" could overwrite the actual main guest's signature.
    const [isMainGuest, setIsMainGuest] = useState<boolean | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitStatus, setSubmitStatus] = useState("")
    const [documents, setDocuments] = useState<RenderedDocument[]>([])
    const [signature, setSignature] = useState<string | null>(null)
    const [accepted, setAccepted] = useState(false)
    const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
    // v4.4 contract signing config (from portal.contract)
    const [signingProvider, setSigningProvider] = useState<SigningProvider | null>(null)
    const [contractDocUuid, setContractDocUuid] = useState<string | null>(null)
    const [hasNativeSignature, setHasNativeSignature] = useState(false)
    const [configurationError, setConfigurationError] = useState<string | null>(null)
    const [contractAlreadyCompleted, setContractAlreadyCompleted] = useState(false)
    // Card-on-file guarantee (backend plan 20260731) — independent of contract
    // signing: a reservation can need BOTH a signature/acceptance AND a card.
    const [guaranteeRequired, setGuaranteeRequired] = useState(false)
    // null = GuaranteeCardForm hasn't reported a status yet. Never assumed
    // "not_started" — the card's real state is only known once it answers.
    const [guaranteeStatus, setGuaranteeStatus] = useState<GuaranteeStatus | null>(null)

    // Native HIT Guest signature → show the canvas. tufirma/null → no canvas.
    // Backend sends the slug "hitguest_signature"; tolerate "hitguest" too.
    // Only the main guest signs — secondary guests never see the canvas.
    const needsSignature =
        !contractAlreadyCompleted
        && isMainGuest === true
        && !!signingProvider
        && signingProvider.includes("hitguest")

    useEffect(() => {
        if (!guestUuid) {
            router.push(`${basePath}/identify`)
            return
        }

        async function loadDocuments() {
            try {
                // Fetch the portal once: it carries the contract config (v4.4) AND the
                // documents (with render/pdf URLs). Pass it to getReservationDocuments
                // to avoid a second portal request.
                const portal = await checkinService.getPortal(reservationUuid)

                const contractInfo = portal.contract

                // Determine whether THIS guest is the main guest (authoritative: portal
                // pivot). Secondary guests must not sign the contract. The identify
                // session is a navigation fallback; if neither identifies the role,
                // block the legal action instead of guessing.
                const me = portal.registeredGuests?.find(g => g.uuid === guestUuid)
                const sessionMain = loadSession(guestUuid)?.isMainGuest
                const resolvedIsMain = me?.isMain ?? sessionMain
                if (typeof resolvedIsMain !== "boolean") {
                    setConfigurationError(
                        "No pudimos confirmar el rol de este huésped en la reserva.",
                    )
                    setIsMainGuest(null)
                    return
                }
                setIsMainGuest(resolvedIsMain)

                // Guest completion and contract completion are independent states.
                // Only the guest flag authorizes the success redirect.
                if (me?.isCompleted) {
                    router.replace(`${basePath}/success?guest_uuid=${guestUuid}`)
                    return
                }

                // Recovery path: /main/sign may have succeeded while /main/complete
                // failed. Do not ask for another signature and do not redirect to a
                // false success; keep the saved form available for a completion retry.
                if (contractInfo?.status === "completed") {
                    setContractAlreadyCompleted(true)
                    setConfigurationError(null)
                    return
                }
                setContractAlreadyCompleted(false)

                // Authoritative source for what applies to THIS reservation's channel
                // (backend plan §4.1/§4.2) — documents[] can hold several Agreement
                // rows now (one per channel in per_source mode), so it no longer
                // identifies the contract on its own.
                const contractPreview = await checkinService.getContractPreview(reservationUuid)

                setConfigurationError(null)
                setSigningProvider(contractPreview.providerSlug)
                setHasNativeSignature(contractInfo?.hasNativeSignature ?? false)
                setContractDocUuid(contractPreview.agreement?.uuid ?? null)
                setGuaranteeRequired(contractPreview.guarantee !== null)

                // Both texts already come fully rendered for this reservation/guest —
                // no separate render call needed (that was only ever for the single
                // legacy document). agreement_and_guarantee shows both in this view.
                const docs: RenderedDocument[] = []
                if (contractPreview.agreement) {
                    docs.push({
                        uuid: contractPreview.agreement.uuid,
                        typeName: "Contrato de Alojamiento",
                        renderedHtml: contractPreview.agreement.rendered,
                    })
                }
                if (contractPreview.guarantee) {
                    docs.push({
                        uuid: "guarantee",
                        typeName: "Garantía de Daños y Consumos",
                        renderedHtml: contractPreview.guarantee.rendered,
                    })
                }
                setDocuments(docs)
                // Auto-expand the first section only — agreement_and_guarantee stacks
                // two legal texts, and opening both by default is a wall of text.
                setExpandedDoc(docs[0]?.uuid ?? null)
            } catch (err) {
                console.warn("[ContractScreen] Could not load contract/documents:", err)
                // Covers the routing-not-configured 422 (backend plan §4.2) the same
                // way as any other load failure: it's a property configuration issue
                // the guest can't fix, so "contact the host" is the right message
                // either way.
                setConfigurationError(
                    "No pudimos cargar el contrato asignado a esta reserva. Contacta al anfitrión.",
                )
                setSigningProvider(null)
                setContractDocUuid(null)
                setGuaranteeRequired(false)
                setDocuments([])
            } finally {
                setIsLoading(false)
            }
        }

        loadDocuments()
    }, [reservationUuid, guestUuid, basePath, router, loadSession])

    const buildProfileExtra = (form: GuestFormData): CompleteSecondaryGuestPayload => {
        return {
            profile: {
                name: form.name,
                lastname: form.lastname,
                email: form.email || undefined,
                phone: form.phone || undefined,
                dateOfBirth: form.dateOfBirth,
                genderId: form.genderId ? Number(form.genderId) : null,
                nationalityId: Number(form.nationalityId),
                cityOfResidence: form.cityOfResidence || undefined,
                countryOfResidenceId: form.countryOfResidenceId ? Number(form.countryOfResidenceId) : undefined,
                identificationExpiryDate: form.identificationExpiryDate || undefined,
            },
            extra: {
                countryOfOriginId: form.countryOfOriginId ? Number(form.countryOfOriginId) : undefined,
                countryDestinationId: form.countryDestinationId ? Number(form.countryDestinationId) : undefined,
                cityOfOrigin: form.cityOfOrigin || undefined,
                reasonForTripId: form.reasonForTripId ? Number(form.reasonForTripId) : undefined,
                documentImage1: form.documentImage1,
                documentImage2: form.documentImage2,
                // Provider-declared dynamic fields (v4.6) — sent verbatim under their keys.
                ...(form.dynamicExtra ?? {}),
            },
        }
    }

    const buildPayload = (form: GuestFormData): CompleteMainGuestPayload => ({
        guestUuid,
        ...buildProfileExtra(form),
    })

    /**
     * Wait for backend to confirm identity verification (Didit webhook processing).
     * Polls portal with backoff. Returns true if verified, false if timed out.
     */
    const waitForVerification = async (): Promise<boolean | "kyc_redirect"> => {
        const MAX_WAIT = 60_000
        let elapsed = 0
        let interval = 3000
        // The backend rejects /verify/result for some reservation sources
        // ("Invalid reservation source." → 404). Stop calling it after the first 404.
        let activeCheckAvailable = true
        while (elapsed < MAX_WAIT) {
            setSubmitStatus(`Verificación en proceso... (${Math.round(elapsed / 1000)}s)`)
            await new Promise(r => setTimeout(r, interval))
            elapsed += interval

            // Active: ask the backend to evaluate the Didit session result.
            // This works even if the Didit webhook was never processed.
            if (activeCheckAvailable) {
                try {
                    const result = await checkinService.checkVerificationResult(reservationUuid, guestUuid)
                    if (result.status === "verified") return true
                    if (result.status === "failed") return false
                    if (result.status === "kyc_required") {
                        // Backend created a KYC session after the biometric pass
                        // (doc expired/missing). Send the guest back to the verify
                        // step — VerifyScreen detects kyc_required and launches it.
                        // Form data stays in localStorage, so nothing is lost.
                        return "kyc_redirect"
                    }
                } catch (error: unknown) {
                    if (normalizeApiError(error).status === 404) activeCheckAvailable = false
                }
            }

            // Passive: check the portal in case the webhook landed meanwhile
            try {
                const portal = await checkinService.getPortal(reservationUuid)
                const guest = portal.registeredGuests.find(g => g.uuid === guestUuid)
                if (guest?.verification?.currentStep === "form") return true
                if (guest?.verification?.currentStep === "rejected") return false
            } catch {}

            interval = Math.min(interval * 1.5, 10000)
        }
        return false
    }

    /**
     * OTP plan 20260731: verificationToken missing/expired on any of the gated
     * endpoints (/sign, /guarantee/setup-intent, /main/complete). Reuses
     * IdentifyScreen's existing "resume" flow — re-submitting /identify there
     * yields a fresh contact_challenge without losing the guest's typed data.
     */
    const redirectToVerification = () => {
        clearVerificationToken(reservationUuid, guestUuid)
        toast.info("Tu sesión de verificación expiró. Verifica el código nuevamente.")
        router.push(`${basePath}/identify?guest_uuid=${guestUuid}`)
    }

    const handleComplete = async () => {
        if (
            configurationError
            || isMainGuest === null
            || (!contractAlreadyCompleted && !signingProvider)
            // contractDocUuid is only required when this guest actually signs
            // natively (/main/sign needs it) — guarantee_only legitimately has
            // no agreement document at all (backend plan §4.2).
            || (needsSignature && !contractDocUuid)
            // The guarantee card is a SEPARATE resource from the contract
            // signature (card-on-file plan §0) — required regardless of
            // contractAlreadyCompleted, since a stalled previous attempt could
            // have signed the contract but never registered the card.
            || (guaranteeRequired && guaranteeStatus !== "active")
        ) return
        if (!contractAlreadyCompleted && !accepted) return
        if (needsSignature && !signature) return

        setIsSubmitting(true)
        setSubmitStatus("")
        try {
            const formKey = `checkin-guest-form-${reservationUuid}`
            const rawForm = localStorage.getItem(formKey)
            if (!rawForm) {
                throw new Error("No se encontraron los datos del formulario.")
            }
            const form: GuestFormData = JSON.parse(rawForm)

            // Main guest: native signature (if any) then /main/complete.
            // Secondary guest: never signs — complete via /secondary/{uuid}/complete so
            // we don't overwrite the main guest's signature.
            const submitAll = async () => {
                if (!isMainGuest) {
                    return checkinService.completeSecondaryGuest(reservationUuid, guestUuid, buildProfileExtra(form))
                }
                if (needsSignature && signature && contractDocUuid) {
                    await checkinService.signMainGuest(reservationUuid, {
                        guestUuid,
                        documentUuid: contractDocUuid,
                        signatureImage: signature,
                    })
                }
                return checkinService.completeMainGuest(reservationUuid, buildPayload(form))
            }

            let lastError: unknown = null
            let completeResult: Awaited<ReturnType<typeof submitAll>> | null = null
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    setSubmitStatus(attempt > 0 ? "Reintentando envío..." : "")
                    completeResult = await submitAll()
                    lastError = null
                    break
                } catch (error: unknown) {
                    lastError = error
                    const normalized = normalizeApiError(error)
                    const msg = normalized.message.toLowerCase()
                    // A 403/422 about the signature is a contract problem, not a
                    // verification one — surface it directly, don't wait/retry.
                    if (msg.includes("firma") || msg.includes("signature")) {
                        throw error
                    }
                    // Otherwise a 403 (or identity_not_verified) on sign/complete means
                    // the backend hasn't confirmed identity verification yet (the Didit
                    // webhook may still be landing). Wait for the portal to flip to
                    // verified, then retry.
                    const isNotVerified = normalized.status === 403 ||
                        msg.includes("identity_not_verified") ||
                        msg.includes("not_verified") ||
                        msg.includes("not been verified")
                    if (isNotVerified && attempt === 0) {
                        toast.info("Tu verificación aún se está procesando. Esperando confirmación...")
                        const verified = await waitForVerification()
                        if (verified === "kyc_redirect") {
                            toast.info("Falta validar tu documento de identidad. Te llevamos a ese paso.")
                            setIsSubmitting(false)
                            setSubmitStatus("")
                            router.push(`${basePath}/verify?guest_uuid=${guestUuid}&from_didit_callback=1`)
                            return
                        }
                        if (!verified) {
                            toast.error("La verificación no pudo completarse. Intenta de nuevo más tarde.")
                            setIsSubmitting(false)
                            setSubmitStatus("")
                            return
                        }
                        toast.success("Verificación confirmada. Enviando datos...")
                        continue
                    }
                    throw error
                }
            }
            if (lastError) throw lastError

            localStorage.removeItem(formKey)
            localStorage.removeItem(`checkin-identify-${reservationUuid}`)
            // Only the main guest's completion flips the reservation-level "main done" flag.
            if (isMainGuest) localStorage.setItem(`checkin-main-done-${reservationUuid}`, 'true')

            // tufirma: the contract is signed externally (email). The main guest's
            // part is registered, but the contract stays "pending_signature" until the
            // guest signs in TuFirma. Surface this on the success screen. (Secondary
            // guests never have a pending signature.)
            const pendingSignature = isMainGuest && completeResult?.status === "pending_signature"
            const sigFlag = pendingSignature ? "&contract_pending=1" : ""

            const portal = await checkinService.getPortal(reservationUuid)

            if (portal.progress.isFullyCompleted) {
                toast.success("¡Check-in completado para todos los huéspedes!")
                router.push(`${basePath}/success?guest_uuid=${guestUuid}${sigFlag}`)
            } else {
                const pending = portal.reservation.totalGuestsAllowed - portal.progress.completed
                toast.success(pendingSignature
                    ? "Tu registro quedó listo. Revisa tu correo de TuFirma para firmar el contrato."
                    : isMainGuest
                        ? "Tu registro está completo. Los acompañantes ya pueden iniciar su registro."
                        : "Tu registro está completo.")
                // main_done drives the "main guest finished" messaging — only for the main guest.
                const mainDoneFlag = isMainGuest ? "&main_done=true" : ""
                router.push(`${basePath}/success?guest_uuid=${guestUuid}${mainDoneFlag}&pending=${pending}${sigFlag}`)
            }
        } catch (error: unknown) {
            const status = normalizeApiError(error).status
            if (status === 409) {
                toast.success("Ya completaste tu check-in anteriormente.")
                router.push(`${basePath}/success?guest_uuid=${guestUuid}`)
            } else if (status === 401) {
                redirectToVerification()
            } else {
                notifyError(error, "Error al completar el check-in")
            }
        } finally {
            setIsSubmitting(false)
            setSubmitStatus("")
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 size={40} className="text-brand-purple animate-spin" />
                <p className="text-sm text-slate-500 mt-4">Cargando contrato...</p>
            </div>
        )
    }

    const hasDocuments = documents.length > 0
    // hitguest (agreement_only only) → needs a signature + acceptance.
    // tufirma (any contract_type, including guarantee_only with no agreement
    // document at all) → just acceptance.
    const isFormValid =
        !configurationError
        && isMainGuest !== null
        // Independent of contractAlreadyCompleted — the card is a different
        // resource than the contract signature (card-on-file plan §0).
        && (!guaranteeRequired || guaranteeStatus === "active")
        && (
            contractAlreadyCompleted
            || (
                signingProvider !== null
                && accepted
                && (!needsSignature || (signature !== null && contractDocUuid !== null))
            )
        )

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={4} totalSteps={5} />

            <div className="flex items-center justify-between">
                <Link href={`${basePath}/guest?guest_uuid=${guestUuid}`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Paso 5 de 6</div>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    {contractAlreadyCompleted
                        ? "Finalizar check-in"
                        : needsSignature
                            ? "Documentos y Firma"
                            : "Documentos del Contrato"}
                </h1>
                <p className="text-slate-500 text-sm">
                    {contractAlreadyCompleted
                        ? "Tu contrato ya está firmado. Solo falta confirmar los datos guardados del registro."
                        : needsSignature
                            ? "Revisa los documentos de tu estadía y firma para finalizar."
                            : "Revisa los documentos de tu estadía y acepta para finalizar."}
                </p>
            </div>

            {contractAlreadyCompleted ? (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700"
                >
                    <p className="font-bold">Contrato firmado correctamente</p>
                    <p className="mt-1">
                        Puedes reintentar la finalización sin volver a firmar ni reemplazar la firma existente.
                    </p>
                </div>
            ) : configurationError ? (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
                >
                    <p className="font-bold">No es posible continuar con la firma</p>
                    <p className="mt-1">{configurationError}</p>
                </div>
            ) : hasDocuments ? (
                <div className="space-y-3">
                    {documents.map((doc) => (
                        <div key={doc.uuid} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setExpandedDoc(expandedDoc === doc.uuid ? null : doc.uuid)}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-brand-purple" />
                                    <h2 className="font-bold text-slate-800 text-sm">{doc.typeName}</h2>
                                </div>
                                {expandedDoc === doc.uuid
                                    ? <ChevronUp size={18} className="text-slate-400" />
                                    : <ChevronDown size={18} className="text-slate-400" />
                                }
                            </button>
                            {expandedDoc === doc.uuid && (
                                <div className="px-5 pb-5 border-t border-slate-100">
                                    <div
                                        className="prose prose-sm prose-slate max-w-none max-h-60 overflow-y-auto pr-2 no-scrollbar pt-4"
                                        dangerouslySetInnerHTML={{ __html: doc.renderedHtml }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <FileText size={20} className="text-brand-purple" />
                        <h2 className="font-bold text-slate-800">Contrato</h2>
                    </div>
                    <p className="text-sm text-slate-400 text-center py-4">
                        No hay documentos configurados para esta propiedad.
                    </p>
                </div>
            )}

            {/* Independent of contractAlreadyCompleted: the guarantee card is a
                different resource from the contract signature (card-on-file
                plan §0) — a stalled previous attempt may have signed the
                contract but never registered the card, so this must still be
                reachable during that recovery path. */}
            {!configurationError && guaranteeRequired && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <GuaranteeCardForm
                        reservationUuid={reservationUuid}
                        guestUuid={guestUuid}
                        onStatusChange={setGuaranteeStatus}
                        onSessionExpired={redirectToVerification}
                    />
                </div>
            )}

            {!configurationError && !contractAlreadyCompleted && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
                {needsSignature && (
                    <>
                        {hasNativeSignature && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <PenLine size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700">
                                    Ya tienes una firma registrada. Si firmas de nuevo, reemplazará la anterior.
                                </p>
                            </div>
                        )}
                        <SignaturePad onSignatureChange={setSignature} />
                    </>
                )}

                {signingProvider === "tufirma" && (
                    <div className="flex items-start gap-3 p-4 bg-brand-purple/5 border border-brand-purple/15 rounded-xl">
                        <Mail size={18} className="text-brand-purple flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-600">
                            Recibirás un correo de <strong>TuFirma</strong> para completar la firma digital de tu
                            contrato. No necesitas firmar aquí.
                        </p>
                    </div>
                )}

                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-purple/30 transition-colors">
                    <div className="relative flex items-center justify-center mt-0.5">
                        <input 
                            type="checkbox" 
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-2 focus:ring-brand-purple/20 checked:bg-brand-purple checked:border-brand-purple transition-all"
                        />
                        <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-slate-600 font-medium select-none">
                        He leído y acepto los términos del contrato de arrendamiento.
                    </span>
                </label>
            </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <button
                        onClick={handleComplete}
                        disabled={!isFormValid || isSubmitting}
                        className="w-full flex flex-col items-center justify-center gap-1 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={20} /> Finalizando...</span>
                                {submitStatus && <span className="text-xs font-normal opacity-80">{submitStatus}</span>}
                            </>
                        ) : (
                            configurationError
                                ? "Contrato no disponible"
                                : contractAlreadyCompleted
                                    ? "Finalizar check-in"
                                : needsSignature
                                    ? "Firmar y Completar"
                                    : "Aceptar y Completar"
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
