"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, FileText, ChevronDown, ChevronUp, Mail, PenLine, RefreshCw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { normalizeApiError, notifyError } from "@/lib/notify-error"
import { normalizeVerificationResult } from "@/features/checkin/lib/verification-result"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { getVerificationTokenState } from "@/features/checkin/lib/verification-token"
import { isDocumentExpired } from "@/features/checkin/lib/document-expiry"
import { classifyCompleteFailure } from "@/features/checkin/lib/complete-failure"
import {
    resolveContractSigningState,
    blocksContractSubmission,
    type ContractSigningState,
} from "@/features/checkin/lib/contract-signing"
import { useVerificationRecovery } from "@/features/checkin/hooks/useVerificationRecovery"
import { buildCompletedCheckinHref } from "@/features/checkin/lib/success-entry"
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
    const expireVerificationSession = useVerificationRecovery(reservationUuid, basePath)

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
    const [isRetryable, setIsRetryable] = useState(false)
    const [contractAlreadyCompleted, setContractAlreadyCompleted] = useState(false)
    // `/main/sign` is not idempotent: every successful call appends a legal
    // signature attempt. Once the portal confirms a native signature, retries may
    // call `/main/complete` again but must never submit the image a second time.
    const [nativeSignatureAlreadySaved, setNativeSignatureAlreadySaved] = useState(false)
    // Reingreso sobre un contrato que ya salió de las manos del huésped
    // (`awaiting_external` / `rejected`). No es un error: es un estado legítimo
    // en el que esta pantalla no tiene ninguna acción que ofrecer.
    const [blockedBy, setBlockedBy] = useState<ContractSigningState | null>(null)
    // Card-on-file guarantee (backend plan 20260731) — independent of contract
    // signing: a reservation can need BOTH a signature/acceptance AND a card.
    const [guaranteeRequired, setGuaranteeRequired] = useState(false)
    // null = GuaranteeCardForm hasn't reported a status yet. Never assumed
    // "not_started" — the card's real state is only known once it answers.
    const [guaranteeStatus, setGuaranteeStatus] = useState<GuaranteeStatus | null>(null)
    /**
     * El huésped resolvió la parte del contrato EN ESTA SESIÓN y pasó a la
     * tarjeta (separación contrato → tarjeta pedida por Didier, 2026-08-19: dos
     * bloques con dos botones primarios en una misma pantalla generaban
     * confusión).
     *
     * Es local a propósito y solo importa en el camino SIN firma nativa
     * (TuFirma / aceptación): ahí "aceptó los términos" no se persiste en el
     * backend hasta `/main/complete`, así que no hay señal del servidor que
     * derive la fase. En el camino nativo la fase avanza sola cuando `/main/sign`
     * responde 200 (`nativeSignatureAlreadySaved`), y en el reingreso la deriva
     * el portal (`hasNativeSignature` / `status`). Un refresh en el camino
     * TuFirma vuelve a la fase 1 a re-aceptar — correcto: esa aceptación nunca
     * salió del navegador.
     */
    const [contractContinued, setContractContinued] = useState(false)

    // Native HIT Guest signature → show the canvas. tufirma/null → no canvas.
    // Backend sends the slug "hitguest_signature"; tolerate "hitguest" too.
    // Only the main guest signs — secondary guests never see the canvas.
    const needsSignature =
        !contractAlreadyCompleted
        && !nativeSignatureAlreadySaved
        && isMainGuest === true
        && !!signingProvider
        && signingProvider.includes("hitguest")

    /** La firma ya está en el backend (esta sesión o un intento anterior). */
    const signatureRecorded = contractAlreadyCompleted || nativeSignatureAlreadySaved

    /**
     * Las dos fases de esta pantalla, DERIVADAS — nunca un enum de UI aparte que
     * pueda desincronizarse del backend (el mismo criterio que ya rige
     * `guaranteeStatus`).
     *
     * Con garantía, el huésped ve primero el contrato y después la tarjeta; sin
     * garantía no hay fases y todo sigue exactamente como antes. La fase avanza
     * con una señal del servidor siempre que exista (`signatureRecorded`), y solo
     * cae en el flag local cuando no hay ninguna (aceptación de TuFirma).
     */
    const showGuaranteePhase = guaranteeRequired && (signatureRecorded || contractContinued)

    const loadDocuments = useCallback(async () => {
        try {
            // Fetch the portal once: it carries the contract config (v4.4) AND the
            // documents (with render/pdf URLs). Pass it to getReservationDocuments
            // to avoid a second portal request.
            const portal = await checkinService.getPortal(reservationUuid)

            // Esta pantalla es la más cara de rehacer: el huésped lee el contrato,
            // registra la tarjeta y FIRMA antes de que se envíe nada. Con el token
            // del OTP ya vencido, /sign y /main/complete responden 401 recién al
            // final y la firma se pierde. Guardar el `expiresAt` permite saberlo
            // acá y rebotarlo antes de que gaste ese trabajo.
            //
            // Solo "expired": "absent" es legítimo — el huésped que hizo biometría
            // nunca tuvo token y no hay que expulsarlo.
            if (getVerificationTokenState(reservationUuid, guestUuid) === "expired") {
                expireVerificationSession(guestUuid)
                return
            }

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

            // Reingreso con la firma ya fuera del portal.
            //
            // Con TuFirma `/main/complete` responde `pending_signature` y el
            // titular queda INCOMPLETO hasta que llegue el webhook, así que el hub
            // lo sigue viendo pendiente y lo devuelve a esta pantalla. Sin este
            // corte volvía a ver el contrato y el botón "Aceptar y Completar", y al
            // pulsarlo chocaba con que los datos del formulario ya se habían
            // borrado del localStorage tras el envío exitoso — un "No se
            // encontraron los datos del formulario" que no explica nada y del que
            // no se sale. Reenviar tampoco era la salida: duplicaría el sobre en
            // TuFirma.
            //
            // Va ANTES de `/contract/preview`: en estos dos estados su respuesta no
            // cambiaría nada de lo que se muestra.
            const signingState = resolveContractSigningState(contractInfo)
            if (blocksContractSubmission(signingState, resolvedIsMain)) {
                setBlockedBy(signingState)
                setConfigurationError(null)
                return
            }
            setBlockedBy(null)

            // Recovery path: /main/sign may have succeeded while /main/complete
            // failed. Do not ask for another signature and do not redirect to a
            // false success; keep the saved form available for a completion retry.
            const completedContract = contractInfo?.status === "completed"
            setContractAlreadyCompleted(completedContract)
            setNativeSignatureAlreadySaved(
                resolvedIsMain
                && contractInfo?.signingProvider?.includes("hitguest") === true
                && (contractInfo.status === "signed" || contractInfo.hasNativeSignature === true),
            )

            // El contrato y la garantía son gates exclusivos del titular. El
            // endpoint de secundarios no firma ni recibe aceptación contractual;
            // imponerla acá sería una regla inventada por el cliente.
            //
            // También es válido que el titular no tenga firma configurada. El
            // portal lo expresa con `signingProvider: null` y /main/complete debe
            // ejecutarse directamente. En ese caso /contract/preview responde 422
            // por diseño, por lo que ni siquiera se debe llamar.
            if (!resolvedIsMain || !contractInfo?.signingProvider) {
                setConfigurationError(null)
                setIsRetryable(false)
                setSigningProvider(null)
                setHasNativeSignature(false)
                setContractDocUuid(null)
                setGuaranteeRequired(false)
                setGuaranteeStatus(null)
                setDocuments([])
                setExpandedDoc(null)
                return
            }

            // Do not return for a completed contract. The guarantee is a separate
            // resource and `/contract/preview` is the authoritative source for
            // whether this reservation still needs a card before `/main/complete`.
            // Returning here allowed a signed contract to bypass the client-side
            // guarantee gate and fail only after submission.

            // Authoritative source for what applies to THIS reservation's channel
            // (backend plan §4.1/§4.2) — documents[] can hold several Agreement
            // rows now (one per channel in per_source mode), so it no longer
            // identifies the contract on its own.
            const contractPreview = await checkinService.getContractPreview(reservationUuid)

            setConfigurationError(null)
            setIsRetryable(false)
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
            const status = normalizeApiError(err).status
            // 422 = property routing not configured for this channel (permanent).
            // Anything else (5xx, network, unknown) = transient, offer retry.
            const permanent = status === 422
            setConfigurationError(
                permanent
                    ? "El anfitrión no ha configurado el contrato para esta reserva. Contacta al alojamiento."
                    : "No pudimos cargar el contrato. Puedes intentarlo de nuevo o contactar al anfitrión.",
            )
            setIsRetryable(!permanent)
            // Un fallo de red no confirma nada sobre el contrato: mostrar el error
            // recuperable es más honesto que dejar clavado el panel de espera de un
            // intento anterior.
            setBlockedBy(null)
            setSigningProvider(null)
            setContractDocUuid(null)
            setNativeSignatureAlreadySaved(false)
            setGuaranteeRequired(false)
            setDocuments([])
        } finally {
            setIsLoading(false)
        }
    }, [reservationUuid, guestUuid, basePath, router, loadSession, expireVerificationSession])

    useEffect(() => {
        if (!guestUuid) {
            router.push(`${basePath}/identify`)
            return
        }

        // `loadDocuments` es async y todo su setState ocurre DESPUÉS del await del
        // portal; la regla no modela ese límite y lo lee como si fuera síncrono.
        // El único camino nuevo que alcanza un setState desde acá es el rebote por
        // token vencido, que además navega enseguida — no hay render en cascada
        // que evitar.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadDocuments()
    }, [guestUuid, basePath, router, loadDocuments])

    const buildProfileExtra = (
        form: GuestFormData,
        includeEditableIdentity = false,
    ): CompleteSecondaryGuestPayload => {
        return {
            profile: {
                name: form.name,
                lastname: form.lastname,
                email: form.email,
                phone: form.phone || undefined,
                dateOfBirth: form.dateOfBirth,
                genderId: form.genderId ? Number(form.genderId) : null,
                nationalityId: Number(form.nationalityId),
                cityOfResidence: form.cityOfResidence || undefined,
                countryOfResidenceId: form.countryOfResidenceId ? Number(form.countryOfResidenceId) : undefined,
                identificationExpiryDate: form.identificationExpiryDate || undefined,
                ...(includeEditableIdentity ? {
                    identificationTypeId: form.identificationTypeId ? Number(form.identificationTypeId) : null,
                    identificationNumber: String(form.identificationNumber ?? "").trim() || null,
                } : {}),
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
     * ¿El portal ya reporta a este huésped como verificado, AHORA MISMO?
     *
     * Es la misma condición con la que `waitForVerification()` da por buena la
     * espera, consultada una sola vez y sin sondeo. Sirve para decidir si esperar
     * tiene sentido: si el portal ya confirma, el sondeo confirmaría de inmediato
     * y el reintento fallaría igual.
     *
     * Ante un fallo de red devuelve `false` — o sea, se comporta como antes y
     * espera. Un problema de red no debe convertirse en un mensaje de error
     * definitivo para el huésped.
     */
    const isVerifiedAccordingToPortal = async (): Promise<boolean> => {
        try {
            const portal = await checkinService.getPortal(reservationUuid)
            if (portal.portalStatus) return false
            const guest = portal.registeredGuests.find(g => g.uuid === guestUuid)
            return normalizeVerificationResult({ verification: guest?.verification }).status === "verified"
        } catch {
            return false
        }
    }

    /**
     * Wait for backend to confirm identity verification (Didit webhook processing).
     * Polls con backoff. La espera termina únicamente cuando el backend informa
     * un desenlace; `isStale` reemplaza el antiguo timeout local de 60 segundos.
     *
     * Los tres desenlaces que NO son "verificado / se agotó el tiempo" mandan al
     * huésped a una pantalla distinta, y son distintos entre sí: `kyc_redirect`
     * tiene una sesión de documento por completar, `restart` no la tiene (hay que
     * reiniciar en /identify para que el backend la vuelva a crear), y
     * `contact_challenge` necesita el código del correo. Colapsarlos habría
     * mandado a dos de los tres a una pantalla que no los puede resolver.
     */
    const waitForVerification = async (): Promise<
        boolean | "kyc_redirect" | "restart" | "contact_challenge" | "stale" | "portal_closed"
    > => {
        let elapsed = 0
        let interval = 3000
        // The backend rejects /verify/result for some reservation sources
        // ("Invalid reservation source." → 404). Stop calling it after the first 404.
        let activeCheckAvailable = true
        while (true) {
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
                        // Backend created a KYC session and marked it explicitly
                        // with sessionType=kyc. Send the guest back to the verify
                        // step — VerifyScreen detects kyc_required and launches it.
                        // Form data stays in localStorage, so nothing is lost.
                        return "kyc_redirect"
                    }
                    if (result.status === "restart_required") return "restart"
                    if (result.status === "contact_challenge") return "contact_challenge"
                    if (result.status === "stale") return "stale"
                } catch (error: unknown) {
                    if (normalizeApiError(error).status === 404) activeCheckAvailable = false
                }
            }

            // Passive: check the portal in case the webhook landed meanwhile.
            //
            // Se resuelve con `normalizeVerificationResult`, el mismo criterio de
            // `isVerifiedAccordingToPortal` y del sondeo de VerifyScreen. Antes
            // esta rama solo aceptaba `currentStep: "form"` mientras que
            // `isVerifiedAccordingToPortal`, veinte líneas más arriba en este
            // mismo archivo, ya aceptaba también `"completed"` — así que un
            // huésped con el check-in ya terminado esperaba los 60 segundos
            // completos para nada.
            try {
                const portal = await checkinService.getPortal(reservationUuid)
                if (portal.portalStatus) return "portal_closed"
                const guest = portal.registeredGuests.find(g => g.uuid === guestUuid)
                const outcome = normalizeVerificationResult({ verification: guest?.verification })
                if (outcome.status === "verified") return true
                if (outcome.status === "failed") return false
                if (outcome.status === "stale") return "stale"
            } catch {}

            interval = Math.min(interval * 1.5, 10000)
        }
    }

    /**
     * OTP plan 20260731: verificationToken missing/expired on any of the gated
     * endpoints (/sign, /guarantee/setup-intent, /main/complete). Reuses
     * IdentifyScreen's existing "resume" flow — re-submitting /identify there
     * yields a fresh contact_challenge without losing the guest's typed data.
     */
    const redirectToVerification = (error?: unknown) => expireVerificationSession(guestUuid, error)

    /**
     * FASE 1 → FASE 2. Cierra la parte del contrato y descubre la tarjeta.
     *
     * Solo existe cuando la reserva exige garantía; sin ella el botón único sigue
     * llamando a `handleComplete` como siempre.
     *
     * La firma se manda ACÁ y fuera de cualquier bucle de reintento —
     * `/main/sign` no es idempotente y cada llamada exitosa agrega un intento
     * legal al historial—. El reintento sigue viviendo en `handleComplete`, que
     * es donde puede repetirse sin consecuencias.
     */
    const handleContractContinue = async () => {
        if (configurationError || blockedBy || isMainGuest === null) return
        if (needsSignature && (!signature || !contractDocUuid)) return
        if (!signatureRecorded && !accepted) return

        // Ya firmado (esta sesión o un intento anterior): nada que mandar, solo
        // descubrir la tarjeta.
        if (!needsSignature || nativeSignatureAlreadySaved) {
            setContractContinued(true)
            return
        }

        setIsSubmitting(true)
        setSubmitStatus("")
        try {
            await checkinService.signMainGuest(reservationUuid, {
                guestUuid,
                documentUuid: contractDocUuid!,
                signatureImage: signature!,
            })
            setNativeSignatureAlreadySaved(true)
            setContractContinued(true)
        } catch (error: unknown) {
            if (normalizeApiError(error).status === 401) {
                redirectToVerification(error)
                return
            }
            notifyError(error, "No pudimos guardar tu firma")
        } finally {
            setIsSubmitting(false)
            setSubmitStatus("")
        }
    }

    const handleComplete = async () => {
        if (
            configurationError
            // Redundante con el render (el botón no existe cuando hay bloqueo),
            // pero el guardia es lo que hace que el estado sea invariante y no
            // dependa de qué se dibujó.
            || blockedBy
            || isMainGuest === null
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
        if (
            signingProvider
            && !contractAlreadyCompleted
            && !nativeSignatureAlreadySaved
            && !accepted
        ) return
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

            // `profile.email` es REQUIRED en ambos /complete (§16/§18). El
            // formulario lo exige, pero este borrador vive en localStorage y
            // puede haberse guardado antes de que ese campo fuera obligatorio.
            // Sin este corte, el huésped firmaba primero y recién ahí recibía un
            // 422 de validación — con la firma ya gastada y sin poder editar el
            // correo desde esta pantalla.
            if (!String(form.email ?? "").trim()) {
                toast.error("Falta tu correo electrónico. Vuelve al formulario para completarlo.")
                router.push(`${basePath}/guest?guest_uuid=${guestUuid}`)
                return
            }

            // Main guest: native signature (if any) then /main/complete.
            // Secondary guest: never signs — complete via /secondary/{uuid}/complete so
            // we don't overwrite the main guest's signature.
            const completeGuest = () => !isMainGuest
                ? checkinService.completeSecondaryGuest(reservationUuid, guestUuid, buildProfileExtra(form, true))
                : checkinService.completeMainGuest(reservationUuid, buildPayload(form))

            // Local transaction state for this click. React state updates are not
            // synchronous, so they cannot protect the second loop iteration from
            // calling `/main/sign` again after the first one succeeded.
            let signatureSaved = nativeSignatureAlreadySaved

            let lastError: unknown = null
            let completeResult: Awaited<ReturnType<typeof completeGuest>> | null = null
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    setSubmitStatus(attempt > 0 ? "Reintentando envío..." : "")
                    if (needsSignature && !signatureSaved && signature && contractDocUuid) {
                        await checkinService.signMainGuest(reservationUuid, {
                            guestUuid,
                            documentUuid: contractDocUuid,
                            signatureImage: signature,
                        })
                        signatureSaved = true
                        setNativeSignatureAlreadySaved(true)
                    }
                    completeResult = await completeGuest()
                    lastError = null
                    break
                } catch (error: unknown) {
                    lastError = error
                    const normalized = normalizeApiError(error)
                    const failure = classifyCompleteFailure(normalized.status, normalized.message)

                    // Ninguno de estos dos se arregla esperando: el de firma es un
                    // problema del contrato, y el del titular depende de OTRA
                    // persona. Se muestran directo.
                    if (failure === "signature" || failure === "main_guest_pending") {
                        throw error
                    }

                    const isNotVerified = failure === "identity_unconfirmed"
                    // Esperar solo tiene sentido si el portal TODAVÍA no confirma al
                    // huésped; si ya lo confirma, el sondeo no puede aportar nada.
                    //
                    // El portal decide con un criterio MÁS DÉBIL que el que acaba de
                    // rechazar este envío (§A.4): reporta `form` con solo
                    // `person_verified_at`, mientras que el backend exige además que
                    // el estado sea `approved` y que el documento no esté vencido.
                    // Cuando el portal ya dice `form`, `waitForVerification()`
                    // confirma al primer sondeo, se reintenta y falla idéntico —
                    // pero el huésped ya se comió la espera y dos mensajes que le
                    // decían que todo iba bien.
                    //
                    // Esto vale para CUALQUIER causa del 403, no solo el documento
                    // vencido: también cubre al huésped rechazado después de haber
                    // sido verificado (el portal lo sigue reportando aprobado porque
                    // mira `person_verified_at` antes que el estado de rechazo), y a
                    // cualquier condición que el backend agregue más adelante.
                    if (isNotVerified && await isVerifiedAccordingToPortal()) {
                        toast.error(
                            isDocumentExpired(form.identificationExpiryDate)
                                // Cuando sabemos la causa, se dice: es accionable.
                                ? "Tu documento de identidad está vencido. Contacta al anfitrión para completar tu check-in."
                                // Si no, se muestra el mensaje del backend tal cual, que
                                // dice más que un "intenta más tarde" inventado.
                                : normalized.message,
                        )
                        setIsSubmitting(false)
                        setSubmitStatus("")
                        return
                    }
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
                        // No hay sesión de documento que abrir: la creación falló.
                        // Reiniciar en /identify hace que el backend la reintente,
                        // sin repetir el reconocimiento facial. Los datos del
                        // formulario sigue en localStorage. Si `/main/sign` ya
                        // respondió 200, el portal conserva esa firma y el reingreso
                        // la detecta mediante `hasNativeSignature`/`status: signed`.
                        if (verified === "restart") {
                            toast.info("No pudimos abrir la validación de tu documento. Reiniciamos ese paso — no tendrás que repetir el reconocimiento facial.")
                            setIsSubmitting(false)
                            setSubmitStatus("")
                            router.push(`${basePath}/identify?guest_uuid=${guestUuid}`)
                            return
                        }
                        if (verified === "contact_challenge") {
                            toast.info("Necesitamos confirmar el código que enviamos a tu correo.")
                            setIsSubmitting(false)
                            setSubmitStatus("")
                            router.push(`${basePath}/contact-challenge?guest_uuid=${guestUuid}`)
                            return
                        }
                        if (verified === "stale") {
                            toast.error("La verificación quedó pendiente más tiempo del esperado. Contacta al anfitrión para que revise tu caso.")
                            setIsSubmitting(false)
                            setSubmitStatus("")
                            return
                        }
                        if (verified === "portal_closed") {
                            toast.error("Esta reserva ya no está disponible. Contacta al anfitrión.")
                            setIsSubmitting(false)
                            setSubmitStatus("")
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
            // tufirma: the contract is signed externally (email). The main guest's
            // part is registered, but the contract stays "pending_signature" until the
            // guest signs in TuFirma. Surface this on the success screen. (Secondary
            // guests never have a pending signature.)
            const pendingSignature = isMainGuest && completeResult?.status === "pending_signature"
            // `pending_signature` explicitly means the main guest is NOT complete
            // yet; secondaries remain locked until TuFirma's webhook. Keep this
            // cache aligned with the server-owned completion state.
            if (isMainGuest && !pendingSignature) {
                localStorage.setItem(`checkin-main-done-${reservationUuid}`, "true")
            } else {
                localStorage.removeItem(`checkin-main-done-${reservationUuid}`)
            }
            const sigFlag = pendingSignature ? "&contract_pending=1" : ""

            // El POST anterior ya hizo commit. Una caída de esta lectura de
            // conveniencia NO autoriza a presentar el envío como fallido (ni a
            // inducir al huésped a repetir una firma no idempotente). La pantalla
            // de success vuelve a leer el portal por su cuenta.
            let portal: Awaited<ReturnType<typeof checkinService.getPortal>> | null = null
            try {
                portal = await checkinService.getPortal(reservationUuid)
            } catch {
                toast.success(pendingSignature
                    ? "Tu registro quedó listo. Revisa tu correo de TuFirma para firmar el contrato."
                    : "Tus datos se guardaron correctamente.")
                const mainDoneFlag = isMainGuest && !pendingSignature ? "&main_done=true" : ""
                router.push(`${basePath}/success?guest_uuid=${guestUuid}${mainDoneFlag}${sigFlag}`)
                return
            }

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
                const mainDoneFlag = isMainGuest && !pendingSignature ? "&main_done=true" : ""
                router.push(`${basePath}/success?guest_uuid=${guestUuid}${mainDoneFlag}&pending=${pending}${sigFlag}`)
            }
        } catch (error: unknown) {
            const status = normalizeApiError(error).status
            if (status === 409) {
                toast.info("Este check-in ya estaba completado.")
                router.push(buildCompletedCheckinHref(basePath, guestUuid, "completion_already_recorded"))
            } else if (status === 401) {
                redirectToVerification(error)
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

    /**
     * El contrato ya salió del portal: o está esperando la firma del huésped en
     * TuFirma, o TuFirma la rechazó. En ninguno de los dos casos esta pantalla
     * tiene una acción que ofrecer, así que se reemplaza entera en vez de mostrar
     * el contrato y un botón que no debe pulsarse.
     *
     * Lo único accionable en la espera es volver a consultar el portal — el
     * huésped puede haber firmado en otra pestaña y volver acá. No hay botón de
     * "reenviar": ese endpoint no existe para el huésped (lo hace el anfitrión),
     * y ofrecerlo sería prometer algo que no se puede cumplir.
     */
    if (blockedBy) {
        const isRejected = blockedBy === "rejected"
        return (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                <ProgressBar currentStep={4} totalSteps={5} />

                <div className="flex items-center justify-between">
                    <Link href={basePath} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Paso 5 de 6</div>
                </div>

                <div
                    role={isRejected ? "alert" : "status"}
                    className={`rounded-2xl border p-6 space-y-3 ${
                        isRejected
                            ? "border-red-200 bg-red-50"
                            : "border-brand-purple/15 bg-brand-purple/5"
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {isRejected
                            ? <XCircle size={22} className="text-red-400 flex-shrink-0" />
                            : <Mail size={22} className="text-brand-purple flex-shrink-0" />}
                        <h1 className={`text-lg font-bold ${isRejected ? "text-red-800" : "text-slate-900"}`}>
                            {isRejected ? "Tu contrato no pudo firmarse" : "Revisa tu correo"}
                        </h1>
                    </div>
                    <p className={`text-sm leading-relaxed ${isRejected ? "text-red-700" : "text-slate-600"}`}>
                        {isRejected
                            ? "La firma digital fue rechazada o no pudo completarse. Tus datos quedaron registrados, pero el anfitrión debe reenviarte el contrato — contáctalo para terminar tu check-in."
                            : <>Ya te enviamos el contrato a tu correo. Ábrelo y fírmalo desde <strong>TuFirma</strong> para terminar tu check-in. Tus datos ya quedaron guardados: no tienes que llenar nada de nuevo aquí.</>}
                    </p>
                    {!isRejected && (
                        <p className="text-xs text-slate-500">
                            Si no lo ves, revisa la carpeta de spam o correo no deseado.
                        </p>
                    )}
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                    <div className="w-full max-w-lg flex flex-col gap-2">
                        {!isRejected && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLoading(true)
                                    loadDocuments()
                                }}
                                className="w-full flex items-center justify-center gap-2 h-12 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-base shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98]"
                            >
                                <RefreshCw size={16} /> Ya firmé, actualizar
                            </button>
                        )}
                        <Link
                            href={basePath}
                            className="w-full flex items-center justify-center h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-base transition-all active:scale-[0.98]"
                        >
                            Volver al inicio
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const hasDocuments = documents.length > 0
    // hitguest (agreement_only only) → needs a signature + acceptance.
    // tufirma (any contract_type, including guarantee_only with no agreement
    // document at all) → just acceptance.
    /** Solo la parte del contrato: es lo que habilita el botón de la FASE 1. */
    const contractPartValid =
        !configurationError
        && isMainGuest !== null
        && (
            signingProvider === null
            || isMainGuest === false
            ||
            signatureRecorded
            || (
                signingProvider !== null
                && accepted
                && (!needsSignature || (signature !== null && contractDocUuid !== null))
            )
        )

    // El envío final suma el gate de la tarjeta. Independiente de
    // `contractAlreadyCompleted` — la tarjeta es un recurso distinto de la firma
    // (card-on-file plan §0), y el backend rechaza `/main/complete` con 422 si
    // falta.
    const isFormValid = contractPartValid && (!guaranteeRequired || guaranteeStatus === "active")

    /** FASE 1 con garantía por delante: el botón continúa, no completa. */
    const isContractPhaseCta = guaranteeRequired && !showGuaranteePhase

    /**
     * Un solo botón primario por pantalla (regla de Didier del 2026-08-19,
     * reintroducida sin querer al agregar la puerta de información de la
     * garantía). Mientras el sub-paso de la garantía tiene su propio CTA
     * («Continuar con confianza», «Autorizar tarjeta»), el cierre fijo se
     * RETIRA en vez de quedarse deshabilitado: el botón más grande y más
     * cercano al pulgar no puede ser uno muerto — el 95% toca ahí y lee
     * «está trabado». Reaparece, ya habilitado, cuando la tarjeta queda
     * activa. Con error de configuración se conserva: ahí es el único CTA
     * («Reintentar carga»).
     */
    const fixedCtaHidden = !configurationError && showGuaranteePhase && guaranteeStatus !== "active"

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
                    {showGuaranteePhase
                        ? "Tarjeta de garantía"
                        : signatureRecorded
                        ? "Finalizar check-in"
                        : signingProvider === null
                            ? "Finalizar check-in"
                        : needsSignature
                            ? "Documentos y Firma"
                            : "Documentos del Contrato"}
                </h1>
                <p className="text-slate-500 text-sm">
                    {showGuaranteePhase
                        ? "Último paso: registra una tarjeta como respaldo del contrato. No se realiza ningún cobro ahora."
                        : signatureRecorded
                        ? "Tu contrato ya está firmado. Solo falta confirmar los datos guardados del registro."
                        : signingProvider === null
                            ? "No se requiere firma digital para completar este registro."
                        : needsSignature
                            ? "Revisa los documentos de tu estadía y firma para finalizar."
                            : "Revisa los documentos de tu estadía y acepta para finalizar."}
                </p>
            </div>

            {/* FASE 2: el contrato ya se resolvió. Se resume en una línea en vez de
                repetir el texto legal completo, para que la pantalla trate una sola
                cosa a la vez — que es el punto de haber separado los dos pasos. */}
            {showGuaranteePhase ? (
                <div
                    role="status"
                    className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700"
                >
                    <CheckCircle2 size={18} className="flex-shrink-0" />
                    <p className="font-bold">
                        {needsSignature || signatureRecorded
                            ? "Contrato firmado"
                            : "Contrato aceptado"}
                    </p>
                </div>
            ) : signatureRecorded ? (
                <div
                    role="status"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700"
                >
                    <p className="font-bold">Firma guardada correctamente</p>
                    <p className="mt-1">
                        Puedes reintentar la finalización sin volver a firmar ni reemplazar la firma existente.
                    </p>
                </div>
            ) : configurationError ? (
                <div
                    role="alert"
                    className={`rounded-2xl border p-5 text-sm ${
                        isRetryable
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-red-200 bg-red-50 text-red-700"
                    }`}
                >
                    <p className="font-bold">No es posible continuar con la firma</p>
                    <p className="mt-1">{configurationError}</p>
                    {isRetryable && (
                        <button
                            type="button"
                            onClick={() => {
                                setConfigurationError(null)
                                setIsRetryable(false)
                                setIsLoading(true)
                                loadDocuments()
                            }}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-200 transition-colors"
                        >
                            <RefreshCw size={14} /> Reintentar
                        </button>
                    )}
                </div>
            ) : signingProvider === null ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
                    Puedes completar el check-in sin firmar un contrato digital.
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
            {!configurationError && showGuaranteePhase && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <GuaranteeCardForm
                        reservationUuid={reservationUuid}
                        guestUuid={guestUuid}
                        onStatusChange={setGuaranteeStatus}
                        onSessionExpired={redirectToVerification}
                    />
                </div>
            )}

            {!configurationError && !contractAlreadyCompleted && !nativeSignatureAlreadySaved && !showGuaranteePhase && (
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

            {!fixedCtaHidden && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    {/* Un solo botón primario en pantalla, siempre. Antes convivían
                        el CTA de la tarjeta y el de finalizar, y competían entre sí. */}
                    <button
                        onClick={isContractPhaseCta ? handleContractContinue : handleComplete}
                        disabled={(isContractPhaseCta ? !contractPartValid : !isFormValid) || isSubmitting}
                        className="w-full flex flex-col items-center justify-center gap-1 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={20} />
                                    {isContractPhaseCta ? "Guardando firma..." : "Finalizando..."}
                                </span>
                                {submitStatus && <span className="text-xs font-normal opacity-80">{submitStatus}</span>}
                            </>
                        ) : (
                            configurationError
                                ? (isRetryable ? "Reintentar carga" : "Contrato no disponible")
                                : isContractPhaseCta
                                    ? (needsSignature ? "Firmar y continuar" : "Aceptar y continuar")
                                : showGuaranteePhase
                                    ? "Completar check-in"
                                : signatureRecorded
                                    ? "Finalizar check-in"
                                : signingProvider === null
                                    ? "Completar check-in"
                                : needsSignature
                                    ? "Firmar y Completar"
                                    : "Aceptar y Completar"
                        )}
                    </button>
                </div>
            </div>
            )}
        </div>
    )
}
