"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, ShieldCheck, Users, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { notifyError } from "@/lib/notify-error"
import { checkinService } from "@/features/checkin/services/checkin-service"
import { useIdentifySession } from "@/features/checkin/hooks/useIdentifySession"
import { ProgressBar } from "@/features/checkin/components/ProgressBar"
import { SearchableSelect } from "@/features/checkin/components/SearchableSelect"
import { ReadOnlyField } from "@/features/checkin/components/ReadOnlyField"
import { CatalogService } from "@/features/auth/services/catalog-service"
import type { IdentifyPayload, IdentifySessionData } from "@/features/checkin/types/checkin"

/** Guest-facing terms hosted by HIT outside this app (hitguest.com root, per Ricardo/Didier thread 20260801). */
const GUEST_TERMS_URL = "https://hitguest.com/terminos-servicio1/"

interface IdentifyScreenProps {
    reservationUuid: string
    basePath: string
    isMainGuest?: boolean
    isSecondary?: boolean
}

export function IdentifyScreen({ reservationUuid, basePath, isMainGuest = true, isSecondary = false }: IdentifyScreenProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    // "Continuar registro" resumes an existing guest → /identify?guest_uuid=...
    // In that mode we prefill their data and LOCK the identity-defining fields
    // (document type + number) so they can't be changed (which would create a
    // conflicting guest and is the root of the duplicate-guest issue).
    const resumeGuestUuid = searchParams.get("guest_uuid") || ""
    const isResume = !!resumeGuestUuid
    const { save, saveRaw } = useIdentifySession(reservationUuid)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true)
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof IdentifyPayload, string>>>({})
    // No backend field for this — the guest record's own createdAt (set when
    // /identify succeeds, which this gate blocks until checked) is the
    // acceptance timestamp, per Ricardo/Didier thread 20260801.
    const [acceptedTerms, setAcceptedTerms] = useState(false)

    const [form, setForm] = useState<{
        name: string
        lastname: string
        nationalityId: number | ""
        identificationTypeId: number | ""
        identificationNumber: string
    }>({
        name: "",
        lastname: "",
        nationalityId: "",
        identificationTypeId: "",
        identificationNumber: "",
    })

    const [countryOptions, setCountryOptions] = useState<Array<{ id: number; label: string; sublabel?: string }>>([])
    const [docTypeOptions, setDocTypeOptions] = useState<Array<{ id: number; label: string }>>([])

    useEffect(() => {
        const catalogs = new CatalogService()
        let mounted = true
        async function load() {
            try {
                // Doc types are loaded separately, country-aware (per the selected
                // nationality's ISO2), so e.g. NIT doesn't show for a person.
                const countries = await catalogs.getCountries()
                if (!mounted) return
                const mappedCountries = (countries || [])
                    .map((c: any) => ({ id: Number(c.id), label: String(c.name), sublabel: c.extra?.iso2 }))
                    .filter(o => Number.isFinite(o.id))
                setCountryOptions(mappedCountries)
            } catch (e) {
                toast.error("No fue posible cargar catálogos. Intenta de nuevo.")
            } finally {
                if (mounted) setIsLoadingCatalogs(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [])

    // Load identification types country-aware: filter by the selected nationality's
    // ISO2 (/catalogs/identification-types?country=CO). Reloads when nationality changes.
    const nationalityIso2 = countryOptions.find(c => c.id === Number(form.nationalityId))?.sublabel
    useEffect(() => {
        let active = true
        new CatalogService().getIdentificationTypesV2(nationalityIso2)
            .then(types => {
                if (!active) return
                setDocTypeOptions((types || []).map(d => ({ id: d.id, label: d.name })))
            })
            .catch(() => {})
        return () => { active = false }
    }, [nationalityIso2])

    // Resume mode: prefill the guest's already-registered data from /form. Reuses the
    // same prefilledData source as the guest form (DRY). Document type/number are then
    // rendered read-only so the identity can't change.
    useEffect(() => {
        if (!isResume) return
        let active = true
        checkinService.getGuestFormSchema(reservationUuid, resumeGuestUuid)
            .then(schema => {
                const p = schema?.prefilledData as Record<string, any> | undefined
                if (!active || !p) return
                setForm(f => ({
                    ...f,
                    name: p.name != null ? String(p.name) : f.name,
                    lastname: p.lastname != null ? String(p.lastname) : f.lastname,
                    nationalityId: p.nationalityId != null ? Number(p.nationalityId) : f.nationalityId,
                    identificationTypeId: p.identificationTypeId != null ? Number(p.identificationTypeId) : f.identificationTypeId,
                    identificationNumber: p.identificationNumber != null ? String(p.identificationNumber) : f.identificationNumber,
                }))
            })
            .catch(() => {})
        return () => { active = false }
    }, [isResume, resumeGuestUuid, reservationUuid])

    // Resolved label for the (read-only) document type in resume mode. Captured once
    // so it survives catalog reloads and remains shown even if the type isn't in the
    // currently-filtered list.
    const [lockedDocTypeLabel, setLockedDocTypeLabel] = useState("")
    const docTypeLabel = docTypeOptions.find(d => d.id === Number(form.identificationTypeId))?.label ?? ""
    useEffect(() => {
        if (isResume && docTypeLabel) setLockedDocTypeLabel(docTypeLabel)
    }, [isResume, docTypeLabel])

    const isValid =
        form.name.trim().length >= 2 &&
        form.lastname.trim().length >= 2 &&
        form.nationalityId !== "" &&
        form.identificationTypeId !== "" &&
        form.identificationNumber.trim().length > 2 &&
        acceptedTerms

    // Detects the backend's "document already registered in this reservation" error.
    const isDuplicateDocError = (e: any): boolean => {
        if (e?.status === 409) return true
        const blob = `${e?.message ?? ""} ${JSON.stringify(e?.errors ?? {})}`.toLowerCase()
        return blob.includes("registrad") || blob.includes("already registered") || blob.includes("already associated")
    }

    /**
     * Resume an existing (incomplete) guest when /identify is rejected because their
     * document is already registered — e.g. they did biometrics, the Didit callback
     * failed, and they came back. Looks the guest up in the portal and routes them to
     * success (if done) or rebuilds a session and continues to verify.
     */
    const resumeExistingGuest = async (payload: IdentifyPayload): Promise<boolean> => {
        try {
            const portal = await checkinService.getPortal(reservationUuid)
            const norm = (s?: string) => (s ?? "").trim().toLowerCase()
            const match = portal.registeredGuests?.find(g =>
                payload.isMainGuest
                    ? g.isMain
                    : norm(g.name) === norm(payload.name) && norm(g.lastname) === norm(payload.lastname)
            )
            if (!match) return false

            if (match.isCompleted) {
                toast.success("Ya completaste tu check-in anteriormente")
                router.push(`${basePath}/success?guest_uuid=${match.uuid}`)
                return true
            }

            const verif: any = (match as any).verification ?? {}
            const status = String(verif.status ?? "").toLowerCase()
            const step = String(verif.currentStep ?? "").toLowerCase()

            // Already verified by the backend → skip straight to the form.
            if (status === "approved" || status === "completed" || step === "form") {
                toast.info("Tu identidad ya fue verificada. Continuamos con tus datos.")
                router.push(`${basePath}/guest?guest_uuid=${match.uuid}`)
                return true
            }

            // A pending Didit session is still available → resume that EXACT session.
            // We must NOT invent a "document_upload" directive when there's no URL —
            // that would switch the provider from Didit to Textract. If we can't safely
            // re-derive the original provider, bail and let the backend handle it
            // (identify should be idempotent and return a fresh verification directive).
            if (verif.verificationUrl) {
                const data: IdentifySessionData = {
                    guestUuid: match.uuid,
                    guestName: match.name,
                    guestLastname: match.lastname,
                    isMainGuest: match.isMain,
                    isCheckinCompleted: false,
                    verification: { type: "session", subtype: "biometric", url: verif.verificationUrl },
                    formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
                    timestamp: Date.now(),
                    identificationTypeId: Number(payload.identificationTypeId) || undefined,
                }
                saveRaw(data)
                toast.info("Ya iniciaste tu registro. Continuamos con tu verificación.")
                router.push(`${basePath}/verify?guest_uuid=${match.uuid}`)
                return true
            }

            return false
        } catch {
            return false
        }
    }

    const handleVerify = async () => {
        if (!isValid) return
        setIsSubmitting(true)
        setFieldErrors({})

        const payload: IdentifyPayload = {
            name: form.name.trim(),
            lastname: form.lastname.trim(),
            nationalityId: Number(form.nationalityId),
            identificationTypeId: Number(form.identificationTypeId),
            identificationNumber: form.identificationNumber.trim(),
            isMainGuest,
        }

        try {
            const response = await checkinService.identify(reservationUuid, payload)

            // G8: Handle already-completed re-entry
            if (response.reservationGuest.isCheckinCompleted) {
                toast.success("Ya completaste tu check-in anteriormente")
                router.push(`${basePath}/success?guest_uuid=${response.guest.uuid}`)
                return
            }

            // Persist session for downstream screens (verify, guest form)
            // Pass identificationTypeId so VerifyScreen knows if back image is required
            save(response, Number(form.identificationTypeId) || undefined)

            // Store trigger for mock routing in VerifyScreen (checkVerificationResult)
            try {
                const triggerKey = `checkin-ident-trigger-${reservationUuid}-${response.guest.uuid}`
                localStorage.setItem(triggerKey, payload.identificationNumber)
            } catch {}

            // G2 + G3: Route based on backend-decided verification.type
            switch (response.verification.type) {
                case "verified_ok":
                    // G6: Guest already verified — skip directly to form
                    router.push(`${basePath}/guest?guest_uuid=${response.guest.uuid}`)
                    break
                case "session":
                case "document_upload":
                    router.push(`${basePath}/verify?guest_uuid=${response.guest.uuid}`)
                    break
                case "contact_challenge":
                    // Recurring guest reusing a previous verification — must prove
                    // possession of their historical email first (OTP plan 20260731).
                    router.push(`${basePath}/contact-challenge?guest_uuid=${response.guest.uuid}`)
                    break
            }
        } catch (e: any) {
            console.error("[IdentifyScreen] 422 error details:", { status: e.status, message: e.message, errors: e.errors })
            // Document already registered → this is almost always the same guest coming
            // back after an interrupted attempt (e.g. failed Didit callback). Resume them
            // instead of dead-ending. Falls through to the error display if not resolvable.
            if (isDuplicateDocError(e)) {
                const resumed = await resumeExistingGuest(payload)
                if (resumed) return
            }
            // G8: Handle specific backend errors
            if (e.status === 403) {
                toast.error("El huésped principal debe completar su registro primero")
                router.push(basePath)
            } else if (e.status === 409) {
                setFieldErrors({ identificationNumber: "Este número de documento ya está registrado en esta reserva." })
                toast.error("Este documento ya está asociado a un huésped en esta reserva")
            } else if (e.status === 422) {
                // Check if it's specifically a max_guests error or a validation error
                if (e.message?.toLowerCase().includes("maximum") || e.message?.toLowerCase().includes("máximo")) {
                    router.push(`${basePath}?error=max_guests`)
                } else if (e.errors && typeof e.errors === 'object') {
                    // Field-level validation errors
                    setFieldErrors(e.errors)
                    toast.error("Por favor revisa los campos marcados")
                } else {
                    notifyError(e, "Error de validación")
                }
            } else if (e.status === 404) {
                toast.error("Reserva no encontrada")
                router.push(basePath)
            } else if (e.errors) {
                // Inline field-level validation errors from backend
                setFieldErrors(e.errors)
                toast.error("Por favor revisa los campos marcados")
            } else {
                notifyError(e, "Error al verificar identidad")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <ProgressBar currentStep={1} totalSteps={isSecondary ? 3 : 5} />

            <div className="flex items-center justify-between">
                <Link href={basePath} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {isSecondary ? "Paso 1 de 4" : "Paso 2 de 6"}
                </div>
            </div>

            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    Verificación de Identidad
                </h1>
                <p className="text-slate-500 text-sm">
                    Necesitamos verificar tu documento para continuar con el registro.
                </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">

                {/* Name + Lastname */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                            Nombres<span className="text-red-400 ml-0.5">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all ${fieldErrors.name ? "border-red-400" : "border-slate-200"}`}
                            placeholder="Ej. Juan Carlos"
                            maxLength={120}
                        />
                        {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                            Apellidos<span className="text-red-400 ml-0.5">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.lastname}
                            onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all ${fieldErrors.lastname ? "border-red-400" : "border-slate-200"}`}
                            placeholder="Ej. Rodríguez Barrera"
                            maxLength={60}
                        />
                        {fieldErrors.lastname && <p className="text-xs text-red-500">{fieldErrors.lastname}</p>}
                    </div>
                </div>

                {/* Nationality (G1: renamed from countryId) */}
                <SearchableSelect
                    label="Nacionalidad"
                    options={countryOptions}
                    value={form.nationalityId}
                    onChange={v => setForm(f => ({ ...f, nationalityId: v }))}
                    placeholder="Seleccionar país..."
                    required
                />

                {/* Doc type + number — read-only when resuming an existing guest so the
                    identity (and thus the guest record) can't change mid-flow. */}
                {isResume ? (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="md:col-span-2">
                            <ReadOnlyField label="Tipo Doc." value={lockedDocTypeLabel || docTypeLabel} />
                        </div>
                        <div className="md:col-span-3">
                            <ReadOnlyField
                                label="Número de Documento"
                                value={form.identificationNumber}
                                hint="No editable: identifica tu registro."
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="md:col-span-2">
                            <SearchableSelect
                                label="Tipo Doc."
                                options={docTypeOptions}
                                value={form.identificationTypeId}
                                onChange={v => setForm(f => ({ ...f, identificationTypeId: v }))}
                                placeholder="Selec."
                                required
                            />
                        </div>
                        <div className="md:col-span-3 space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">
                                Número de Documento<span className="text-red-400 ml-0.5">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.identificationNumber}
                                onChange={e => {
                                    const sanitized = e.target.value.replace(/[^a-zA-Z0-9]/g, "")
                                    setForm(f => ({ ...f, identificationNumber: sanitized }))
                                }}
                                onPaste={e => {
                                    e.preventDefault()
                                    const text = (e.clipboardData.getData("text") || "").replace(/[^a-zA-Z0-9]/g, "")
                                    setForm(f => ({ ...f, identificationNumber: text }))
                                }}
                                className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all ${fieldErrors.identificationNumber ? "border-red-400" : "border-slate-200"}`}
                                placeholder="Ej. 1234567890"
                                maxLength={30}
                                inputMode="text"
                                pattern="[A-Za-z0-9]*"
                            />
                            {fieldErrors.identificationNumber && <p className="text-xs text-red-500">{fieldErrors.identificationNumber}</p>}
                        </div>
                    </div>
                )}

                {/* isMainGuest indicator */}
                {!isSecondary && (
                    <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <Users size={14} />
                        <span>Estás registrando al huésped principal</span>
                    </div>
                )}
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">
                    Tus datos están protegidos con cifrado de extremo a extremo y solo se usarán para el check-in.
                </p>
            </div>

            <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-purple/30 transition-colors">
                <div className="relative flex items-center justify-center mt-0.5">
                    <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-2 focus:ring-brand-purple/20 checked:bg-brand-purple checked:border-brand-purple transition-all"
                    />
                    <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                </div>
                <span className="text-sm text-slate-600 font-medium select-none">
                    Acepto los Términos y Condiciones de HIT —{" "}
                    <a
                        href={GUEST_TERMS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-purple underline hover:no-underline"
                    >
                        Ver términos y condiciones
                    </a>
                </span>
            </label>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/50 z-10 flex justify-center">
                <div className="w-full max-w-lg">
                    <button
                        onClick={handleVerify}
                        disabled={!isValid || isSubmitting || isLoadingCatalogs}
                        className="w-full flex items-center justify-center gap-2 h-14 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-purple/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="animate-spin" size={20} /> Verificando...</>
                        ) : (
                            isLoadingCatalogs ? "Cargando..." : "Verificar Identidad"
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
